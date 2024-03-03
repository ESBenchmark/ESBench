import { cwd, stdout } from "process";
import { join, relative } from "path";
import { mkdtempSync } from "fs";
import { performance } from "perf_hooks";
import { normalize } from "path/posix";
import { Awaitable, durationFmt, MultiMap } from "@kaciras/utilities/node";
import glob from "fast-glob";
import chalk from "chalk";
import picomatch from "picomatch";
import { Nameable, ToolchainOptions } from "./config.js";
import { ClientMessage } from "../runner.js";
import { FilterOptions } from "./host.js";
import noBuild from "../builder/default.js";
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
	 * and reject when receive error message or `fail` is called.
	 */
	promise: Promise<unknown>;

	/**
	 *
	 * @param error
	 */
	fail(error: Error): void;

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

	start?(): Awaitable<unknown>;

	close?(): Awaitable<unknown>;

	execute(options: ExecuteOptions): Awaitable<unknown>;
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
	private readonly e2b = new MultiMap<Executor, Builder>();
	private readonly bOutput = new Map<Builder, BuildResult>();

	private readonly directory: string;
	private readonly filter: FilterOptions;

	constructor(directory: string, filter: FilterOptions) {
		this.directory = directory;
		this.filter = filter;
	}

	add(toolchain: Required<ToolchainOptions>) {
		const { include, builders, executors } = toolchain;
		const builderRE = resolveRE(this.filter.builder);
		const executorRE = resolveRE(this.filter.executor);
		const workingDir = cwd();

		const ue = executors
			.filter(executor => executorRE.test(executor.name))
			.map(this.unwrapNameable.bind(this, "execute"));

		// Ensure glob patterns is relative and starts with ./ or ../
		const dotGlobs = include.map(p => {
			p = relative(workingDir, p).replaceAll("\\", "/");
			return /\.\.?\//.test(p) ? p : "./" + p;
		});

		for (const builder of builders) {
			if (!builderRE.test(builder.name)) {
				continue;
			}
			const builderUsed = this.unwrapNameable("build", builder);
			this.bInclude.add(builderUsed, ...dotGlobs);
			this.e2b.distribute(ue, builderUsed);
		}

		for (const executor of ue) {
			this.eInclude.add(executor, ...dotGlobs);
		}
	}

	async build() {
		const { directory, bOutput, t2n } = this;
		const { file, shared } = this.filter;

		const pathFilter = file && relative(cwd(), file).replaceAll("\\", "/");
		const sharedFilter = SharedModeFilter.parse(shared);

		for (const [builder, include] of this.bInclude) {
			const name = t2n.get(builder)!;
			let files = sharedFilter.select(await glob(include));
			if (pathFilter) {
				files = files.filter(p => p.includes(pathFilter));
			}

			if (files.length === 0) {
				continue;
			}
			if (builder !== noBuild) {
				stdout.write(`Building suites with ${name}... `);
			}

			const root = mkdtempSync(join(directory, "build-"));
			const start = performance.now();
			await builder.build(root, files);
			const time = performance.now() - start;

			if (builder !== noBuild) {
				const t = durationFmt.formatDiv(time, "ms");
				console.log(chalk.greenBright(t));
			}
			bOutput.set(builder, { name, root, files });
		}
	}

	* getJobs() {
		for (const [executor, builders] of this.e2b) {
			const isMatch = picomatch(this.eInclude.get(executor)!);
			const builds = [];

			for (const name of builders) {
				const output = this.bOutput.get(name)!;
				if (!output) {
					continue;
				}
				const files = output.files.filter(p => isMatch(normalize(p)));
				builds.push({ ...output, files });
			}

			if (builds.length === 0) {
				continue;
			}
			const executorName = this.t2n.get(executor)!;
			yield { executorName, executor, builds } as Job;
		}
	}

	private unwrapNameable(keyMethod: string, tool: Nameable<any>) {
		const { name } = tool;
		if (!name) {
			throw new Error("Tool name must be a non-empty string");
		}
		if (tool[keyMethod] === undefined) {
			tool = tool.use;
		}

		const n = this.t2n.get(tool);
		if (n !== undefined) {
			if (n === name) {
				return tool;
			}
			throw new Error(`A tool can only have one name (${n} vs ${name})`);
		}

		for (const [t, n] of this.t2n as any) {
			if (t[keyMethod] === undefined) {
				continue;
			}
			if (n === name) {
				throw new Error("Each tool must have a unique name: " + name);
			}
		}
		this.t2n.set(tool, name);
		return tool;
	}
}
