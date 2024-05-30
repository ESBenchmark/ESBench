import { cwd } from "process";
import { basename, join, relative } from "path";
import { mkdtempSync } from "fs";
import { normalize } from "path/posix";
import { Awaitable, MultiMap, UniqueMultiMap } from "@kaciras/utilities/node";
import glob from "fast-glob";
import picomatch from "picomatch";
import { Channel, ClientMessage, ToolchainResult } from "../connect.js";
import { FilterOptions } from "./commands.js";
import { HostLogger } from "./logger.js";
import { resolveRE, SharedModeFilter } from "../utils.js";

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

export interface ExecuteOptions {
	/**
	 * A folder where the executor can save temporal files.
	 */
	tempDir: string;

	/**
	 * Output directory of the build, can be used to resolve imports.
	 */
	root: string;

	/**
	 * Paths (relative to cwd) of suite files to run.
	 */
	files: string[];

	/**
	 * Run benchmark with names matching the Regex pattern.
	 */
	pattern?: string;

	/**
	 * Used to wait runner finish, it will resolve when receive result message,
	 * and reject when receive error message or `reject` is called.
	 */
	promise: Promise<ToolchainResult[]>;

	/**
	 * Make execution fail, useful for executions that can't wait to finish.
	 */
	reject(error: Error): void;

	/**
	 * Executor should forward messages from suites to this function.
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
	start?(): Awaitable<unknown>;

	/**
	 * Called only once after all suites execution finished, or an error occurred during the execution.
	 */
	close?(): Awaitable<unknown>;

	/**
	 * This method is called for every build output.
	 *
	 * An execution will complete when ESBenchResult is passed to `options.dispatch`
	 * and the returned Promise is satisfied (is present).
	 */
	execute(options: ExecuteOptions): Awaitable<unknown>;
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

export interface ToolChainItem {
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

export default class JobGenerator {

	private readonly t2n = new Map<Builder | Executor, string>();
	private readonly bInclude = new MultiMap<Builder, string>();
	private readonly eInclude = new MultiMap<Executor, string>();
	private readonly e2b = new UniqueMultiMap<Executor, Builder>();
	private readonly bOutput = new Map<Builder, BuildResult>();

	private readonly directory: string;
	private readonly filter: FilterOptions;
	private readonly logger: HostLogger;

	constructor(directory: string, filter: FilterOptions, logger: HostLogger) {
		this.directory = directory;
		this.filter = filter;
		this.logger = logger;
	}

	add(toolchain: ToolChainItem) {
		const { include, builders, executors } = toolchain;
		const builderRE = resolveRE(this.filter.builder);
		const executorRE = resolveRE(this.filter.executor);
		const workingDir = cwd();

		const ue = executors
			.filter(executor => executorRE.test(executor.name))
			.map(this.unwrap.bind(this, "execute"));

		// Ensure glob patterns is relative and starts with ./ or ../
		const dotGlobs = include.map(p => {
			p = relative(workingDir, p).replaceAll("\\", "/");
			return /\.\.?\//.test(p) ? p : "./" + p;
		});

		for (const builder of builders) {
			if (!builderRE.test(builder.name)) {
				continue;
			}
			const builderUsed = this.unwrap("build", builder);
			this.bInclude.add(builderUsed, ...dotGlobs);
			this.e2b.distribute(ue, builderUsed);
		}

		for (const executor of ue) {
			this.eInclude.add(executor, ...dotGlobs);
		}
	}

	async build() {
		const { directory, bInclude, bOutput, t2n } = this;
		const { file, shared } = this.filter;

		this.logger.info(`Building suites with ${bInclude.size} builders [tempDir = ${directory}]...`);

		const pathFilter = file && relative(cwd(), file).replaceAll("\\", "/");
		const sharedFilter = SharedModeFilter.parse(shared);

		for (const [builder, include] of bInclude) {
			let files = sharedFilter.select(await glob(include));
			if (pathFilter) {
				files = files.filter(p => p.includes(pathFilter));
			}
			if (files.length === 0) {
				continue;
			}

			const root = mkdtempSync(join(directory, "build-"));
			const name = t2n.get(builder)!;
			this.logger.debug(`├─ ${name} [${basename(root)}]: ${files.length} suites.`);

			await builder.build(root, files);
			bOutput.set(builder, { name, root, files });
		}
	}

	* getJobs() {
		for (const [executor, builders] of this.e2b) {
			const isMatch = picomatch(this.eInclude.get(executor)!);
			const builds = [];

			// Only add builds that have files match the executor's glob pattern.
			for (const name of builders) {
				const output = this.bOutput.get(name)!;
				if (!output) {
					continue;
				}
				const files = output.files.filter(p => isMatch(normalize(p)));
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
