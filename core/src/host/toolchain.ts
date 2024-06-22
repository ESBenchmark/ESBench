import { cwd } from "process";
import { basename, join, relative } from "path";
import { mkdtempSync } from "fs";
import { Awaitable, MultiMap, UniqueMultiMap } from "@kaciras/utilities/node";
import glob from "fast-glob";
import { HostContext } from "./context.js";
import { Channel } from "../connect.js";

/*
 * Version should not be included in the suggested name, reasons:
 * 1) The version number may be too long.
 * 2) Dependencies cloud be updated frequently, in most cases we don't care about it,
 *    but a change in the name can prevent comparisons.
 * 3) If you want to compare the performance of different versions of the tool,
 *    you should add them both to the configuration and set the name.
 */

export interface Builder {
	/**
	 * Suggest a name for the builder, it will be used if no name specified from config.
	 */
	name: string;

	/**
	 * Transform the files needed for the benchmark.
	 * The path of the generated entry must be [outDir]/index.js
	 *
	 * @param outDir The directory in which all generated chunks should be placed.
	 * @param files Suite file paths relative to cwd.
	 */
	build(outDir: string, files: string[]): Awaitable<void>;
}

/**
 * The entry file that build output needs to export a function that match the signature.
 *
 * This function needs to call `runAndSend` and provide the import module function.
 */
export type EntryExport = (postMessage: Channel, files: string[], pattern?: string) => Promise<void>;

export interface Executor {
	/**
	 * Suggest a name for the executor, it will be used if no name specified from config.
	 */
	name: string;

	/**
	 * Called once before the executor starts executing suites.
	 */
	start?(ctx: HostContext): Awaitable<unknown>;

	/**
	 * Called only once after all suites execution finished, or an error occurred during the execution.
	 */
	close?(ctx: HostContext): Awaitable<unknown>;

	/**
	 * This method is called for every build output.
	 *
	 * An execution will complete when ESBenchResult is passed to `options.dispatch`
	 * and the returned Promise is satisfied (is present).
	 */
	execute(build: BuildResult, ctx: HostContext): Awaitable<unknown>;
}

/**
 * You can assign a name for a tool (builder or executor). Each tool can only have one name.
 *
 * @example
 * export default defineConfig({
 *   toolchains: [{
 *     builders: [
 *       new ViteBuilder({ build: { minify: false } }),
 *       {
 *           name: "Vite Minified"
 *           use: new ViteBuilder({ build: { lib: false, minify: true } }),
 *       }
 *     ]
 *   }]
 * });
 */
export type Nameable<T> = T | { name: string; use: T };

// Only the `exclude` is not necessary.
export interface ToolChainItem {
	exclude?: string[];
	include: string[];
	builders: Array<Nameable<Builder>>;
	executors: Array<Nameable<Executor>>;
}

export interface BuildResult {
	name: string;
	root: string;
	files: string[];
}

export interface Job {
	executorName: string;
	executor: Executor;
	builds: BuildResult[];
}

export function toSpecifier(path: string, parent: string) {
	path = relative(parent, path);
	path = path.replaceAll("\\", "/");
	return /\.\.?\//.test(path) ? path : "./" + path;
}

interface Patterns {
	include: string[];
	exclude: string[];
	matches?: string[];
}

function globInto(set: Set<string>, patterns: Patterns) {
	const { include, exclude } = patterns;
	patterns.matches ??= glob.sync(include, {
		ignore: exclude,
	});
	for (const file of patterns.matches) set.add(file);
}

export default class JobGenerator {

	private readonly t2n = new Map<Builder | Executor, string>();
	private readonly bPatterns = new MultiMap<Builder, Patterns>();
	private readonly ePatterns = new MultiMap<Executor, Patterns>();
	private readonly e2b = new UniqueMultiMap<Executor, Builder>();
	private readonly bOutput = new Map<Builder, BuildResult>();

	private readonly context: HostContext;

	constructor(context: HostContext) {
		this.context = context;
	}

	/**
	 * Convenience functions for generating jobs using the context's toolchains.
	 */
	static async generate(context: HostContext) {
		const generator = new JobGenerator(context);
		for (const toolchain of context.config.toolchains) {
			generator.add(toolchain);
		}
		await generator.build();
		return Array.from(generator.getJobs());
	}

	add(toolchain: ToolChainItem) {
		const { exclude = [], include, builders, executors } = toolchain;
		const { filter } = this.context;

		const builderRE = filter.builder;
		const executorRE = filter.executor;
		const workingDir = cwd();

		const ue = executors
			.filter(executor => executorRE.test(executor.name))
			.map(this.unwrap.bind(this, "execute"));

		// Ensure glob patterns is relative and starts with ./ or ../
		const patterns = {
			include: include.map(i => toSpecifier(i, workingDir)),
			exclude: exclude.map(i => toSpecifier(i, workingDir)),
		};

		for (const executor of ue) {
			this.ePatterns.add(executor, patterns);
		}
		for (const builder of builders) {
			if (!builderRE.test(builder.name)) {
				continue;
			}
			const builderUsed = this.unwrap("build", builder);
			this.e2b.distribute(ue, builderUsed);
			this.bPatterns.add(builderUsed, patterns);
		}
	}

	async build() {
		const { context, bPatterns, bOutput, t2n } = this;
		const { config: { tempDir }, filter } = context;

		const part = filter.file ? relative(cwd(), filter.file).replaceAll("\\", "/") : "";
		context.info(`Building suites with ${bPatterns.size} builders [tempDir=${tempDir}]...`);

		for (const [builder, include] of bPatterns) {
			const dedupe = new Set<string>();
			for (const patterns of include) {
				globInto(dedupe, patterns);
			}

			const files = [];
			for (const file of dedupe) {
				if (file.includes(part))
					files.push(file);
			}
			if (files.length === 0) {
				continue;
			}

			const root = mkdtempSync(join(tempDir, "build-"));
			const name = t2n.get(builder)!;
			context.debug(`├─ ${name} [${basename(root)}]: ${files.length} suites.`);

			await builder.build(root, files);
			bOutput.set(builder, { name, root, files });
		}
	}

	* getJobs() {
		for (const [executor, builders] of this.e2b) {
			const dedupe = new Set<string>();
			const builds = [];

			for (const patterns of this.ePatterns.get(executor)!) {
				globInto(dedupe, patterns);
			}

			// Only add builds that have files match the executor's glob pattern.
			for (const name of builders) {
				const output = this.bOutput.get(name)!;
				if (!output) {
					continue;
				}
				const files = output.files.filter(f => dedupe.has(f));
				if (files.length) {
					builds.push({ ...output, files });
				}
			}

			// Executors without files to execute will be skipped.
			if (builds.length) {
				const executorName = this.t2n.get(executor)!;
				yield { executorName, executor, builds } as Job;
			}
		}
	}

	private unwrap(keyMethod: string, tool: Nameable<any>) {
		const { name } = tool;
		if (/^\s*$/.test(name)) {
			throw new Error("Tool name must be a non-blank string");
		}
		if (!(keyMethod in tool)) {
			tool = tool.use;
		}

		for (const [t, n] of this.t2n) {
			if (!(keyMethod in t)) {
				continue; // Allow builder to have the same name with executor.
			}
			if (t !== tool && n === name) {
				throw new Error("Each tool must have a unique name: " + name);
			}
		}

		const exist = this.t2n.get(tool);
		if (exist === name) {
			return tool;
		} else if (!exist) {
			this.t2n.set(tool, name);
			return tool;
		} else {
			throw new Error(`A tool can only have one name (${exist} vs ${name})`);
		}
	}
}
