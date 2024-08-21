import { cwd } from "node:process";
import { basename, join, relative } from "node:path";
import { mkdtempSync } from "node:fs";
import { Awaitable, UniqueMultiMap } from "@kaciras/utilities/node";
import glob from "fast-glob";
import { HostContext } from "./context.js";
import { Channel, ClientMessage } from "../connect.js";

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

export interface SuiteTask {
	/**
	 * Output directory of the build, can be used to resolve imports.
	 */
	root: string;

	/**
	 * Path (relative to cwd) of the suite file to run.
	 */
	file: string;

	/**
	 * Run benchmark with names matching the Regex pattern.
	 */
	pattern?: string;

	/**
	 * Make execution fail, useful for executions that can't wait to finish.
	 */
	reject(error: Error): void;

	/**
	 * Executor should forward messages from `EntryExport` to this function.
	 */
	dispatch(message: ClientMessage): void;
}

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
	 *
	 * If an implementation uses exclusive global resources, it should return a Promise
	 * for asynchronous operations so that ESBench can wait for resources to be released.
	 */
	close?(ctx: HostContext): Awaitable<unknown>;

	/**
	 * Run a suite of a builder output.
	 *
	 * An execution will complete when `ESBenchResult` is passed to `task.dispatch`
	 * and the returned Promise is satisfied (if present).
	 */
	execute(task: SuiteTask): Awaitable<unknown>;
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
	name: string;
	executor: Executor;
	builds: BuildResult[];
}

export function toSpecifier(path: string, parent: string) {
	path = relative(parent, path);
	path = path.replaceAll("\\", "/");
	return /\.\.?\//.test(path) ? path : "./" + path;
}

export default class JobGenerator {

	private readonly t2n = new Map<Builder | Executor, string>();
	private readonly bFiles = new UniqueMultiMap<Builder, string>();
	private readonly eFiles = new UniqueMultiMap<Executor, string>();
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

	add(item: ToolChainItem) {
		const { builder: builderRE, executor: executorRE, shared, file } = this.context.filter;

		const found = this.scanSuiteFiles(item);
		const part = file ? relative(cwd(), file).replaceAll("\\", "/") : "";

		const files = [];
		for (const file of found) {
			if (!file.includes(part))
				continue;
			if (shared.roll()) {
				files.push(file);
			}
		}
		if (files.length === 0) {
			return; // No file matches, skip this item.
		}

		const ue = item.executors
			.filter(executor => executorRE.test(executor.name))
			.map(this.unwrap.bind(this, "execute"));

		for (const executor of ue) {
			this.eFiles.add(executor, ...files);
		}
		for (const builder of item.builders) {
			if (!builderRE.test(builder.name)) {
				continue;
			}
			const builderUsed = this.unwrap("build", builder);
			this.e2b.distribute(ue, builderUsed);
			this.bFiles.add(builderUsed, ...files);
		}
	}

	async build() {
		const { context, bFiles, bOutput, t2n } = this;
		const { config: { tempDir } } = context;
		context.info(`Building suites with ${bFiles.size} builders [tempDir=${tempDir}]...`);

		for (const [builder, set] of bFiles) {
			const files = Array.from(set);
			const root = mkdtempSync(join(tempDir, "build-"));
			const name = t2n.get(builder)!;
			context.debug(`├─ ${name} [${basename(root)}]: ${files.length} suites.`);

			await builder.build(root, files);
			bOutput.set(builder, { name, root, files });
		}
	}

	* getJobs() {
		for (const [executor, builders] of this.e2b) {
			const dedupe = this.eFiles.get(executor)!;
			const builds = [];

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
				const name = this.t2n.get(executor)!;
				yield { name, executor, builds } as Job;
			}
		}
	}

	private scanSuiteFiles(item: ToolChainItem) {
		let { exclude = [], include } = item;
		const workingDir = cwd();

		// Ensure glob patterns is relative and starts with ./ or ../
		include = include.map(i => toSpecifier(i, workingDir));
		exclude = exclude.map(i => toSpecifier(i, workingDir));

		return glob.sync(include, { ignore: exclude });
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
