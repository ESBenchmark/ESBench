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

interface ExecutorEntry {
	chainIndex: number;
	listIndex: number;
	name: string;
	tool: Executor;
	fileSet: Set<string>;
}

interface BuilderEntry extends Omit<ExecutorEntry, "tool"> {
	tool: Builder;
	output: BuildResult;
}

export default class JobGenerator {

	private readonly eSet = new Map<Executor, ExecutorEntry>();
	private readonly bSet = new Map<Builder, BuilderEntry>();

	private readonly e2b = new UniqueMultiMap<ExecutorEntry, BuilderEntry>();

	private readonly context: HostContext;

	constructor(context: HostContext) {
		this.context = context;
	}

	/**
	 * Convenience functions for generating jobs using the context's toolchains.
	 */
	static async generate(context: HostContext) {
		const generator = new JobGenerator(context);
		const { toolchains } = context.config;
		for (let i = 0; i < toolchains.length; i++) {
			generator.add(toolchains[i], i);
		}
		await generator.build();
		return Array.from(generator.getJobs());
	}

	add(item: ToolChainItem, index = -1) {
		const { builder: builderRE, executor: executorRE } = this.context.filter;

		const files = this.scanSuiteFiles(item);
		if (files.length === 0) {
			return; // No file matches, skip this item.
		}

		const eEntries = item.executors
			.filter(executor => executorRE.test(executor.name))
			.map(this.normalize.bind(this, index, this.eSet));

		for (const executor of eEntries) {
			files.forEach(Set.prototype.add, executor.fileSet);
		}
		for (let i = 0; i < item.builders.length; i++) {
			const builder = item.builders[i];
			if (!builderRE.test(builder.name)) {
				continue;
			}
			const builderUsed = this.normalize(index, this.bSet, builder, i);
			this.e2b.distribute(eEntries, builderUsed);
			files.forEach(Set.prototype.add, builderUsed.fileSet);
		}
	}

	async build() {
		const { context, bSet } = this;
		const { config: { tempDir } } = context;
		context.info(`Building suites with ${bSet.size} builders [tempDir=${tempDir}]...`);

		for (const entry of bSet.values()) {
			const root = mkdtempSync(join(tempDir, "build-"));
			const { name, fileSet, tool } = entry;
			const files = Array.from(fileSet);
			context.debug(`├─ ${name} [${basename(root)}]: ${files.length} suites.`);

			await tool.build(root, files);
			entry.output = { name, root, files };
		}
	}

	* getJobs() {
		for (const [entry, builders] of this.e2b) {
			const { tool: executor, name, fileSet } = entry;
			const builds = [];

			// Only add builds that have files match the executor's glob pattern.
			for (const { output } of builders) {
				const files = output.files.filter(f => fileSet.has(f));
				if (files.length) {
					builds.push({ ...output, files });
				}
			}

			// Executors without files to execute will be skipped.
			if (builds.length) {
				yield { name, executor, builds } as Job;
			}
		}
	}

	private scanSuiteFiles({ exclude = [], include }: ToolChainItem) {
		const { shared, file } = this.context.filter;
		const workingDir = cwd();

		// Ensure glob patterns is relative and starts with ./ or ../
		include = include.map(i => toSpecifier(i, workingDir));
		exclude = exclude.map(i => toSpecifier(i, workingDir));

		const part = file ? relative(cwd(), file).replaceAll("\\", "/") : "";

		return glob.sync(include, { ignore: exclude })
			.filter(i => i.includes(part) && shared.roll());
	}

	/*
	 * Since TypeScript does not yet support generic inference of `Function.bind`,
	 * we use `Map<any, any>` for now.
	 *
	 * https://github.com/microsoft/TypeScript/issues/54707
	 */
	private normalize(i: number, set: Map<any, any>, nameable: Nameable<any>, j: number) {
		const { name } = nameable;
		const [keyMethod, type] = set === this.bSet
			? ["build", "builders"]
			: ["execute", "executors"];

		if (/^\s*$/.test(name)) {
			const loc = getLocation(type, i, j);
			throw new Error("Tool name must be a non-blank string\n└─ " + loc);
		}

		// Assume the name wrapper does not have any extra property.
		const tool = keyMethod in nameable ? nameable : (nameable as any).use;

		for (const [t, e] of set) {
			if (t !== tool && e.name === name) {
				throw conflict(type, "Each tool must have a unique name: " + name, i, j, e);
			}
		}

		let exist = set.get(tool);
		if (!exist) {
			set.set(tool, exist = {
				name,
				tool,
				chainIndex: i,
				listIndex: j,
				fileSet: new Set<string>(),
			});
		}

		if (exist.name === name) {
			return exist;
		} else {
			throw conflict(type, `A tool can only have one name (${exist.name} vs ${name})`, i, j, exist);
		}
	}
}

function getLocation(type: string, i: number, j: number) {
	return `toolchains[${i}].${type}[${j}]`;
}

function conflict(type: string, message: string, i: number, j: number, prev: any) {
	message += "\n├─ ";
	message += getLocation(type, prev.chainIndex, prev.listIndex);
	return new Error(message + "\n└─ " + getLocation(type, i, j));
}
