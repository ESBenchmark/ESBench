import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { join, relative } from "path";
import { normalize } from "path/posix";
import { cwd, stdout } from "process";
import { performance } from "perf_hooks";
import chalk from "chalk";
import glob from "fast-glob";
import { durationFmt, MultiMap } from "@kaciras/utilities/node";
import { deserializeError } from "serialize-error";
import picomatch from "picomatch";
import { Builder, ExecuteOptions, Executor } from "./toolchain.js";
import { ESBenchConfig, Nameable, normalizeConfig, ToolchainOptions } from "./config.js";
import { ClientMessage, ESBenchResult, RunSuiteError, ToolchainResult } from "../index.js";
import { consoleLogHandler, resolveRE, SharedModeFilter } from "../utils.js";
import noBuild from "../builder/default.js";

interface FilterOptions {
	file?: string;
	builder?: string | RegExp;
	executor?: string | RegExp;
	name?: string | RegExp;
	shared?: string;
}

interface BuildResult {
	name: string;
	root: string;
	files: string[];
}

interface Job {
	executorName: string;
	executor: Executor;
	builds: BuildResult[];
}

export class JobGenerator {

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

	getName(tool: Builder | Executor) {
		const name = this.t2n.get(tool);
		if (name) {
			return name;
		}
		throw new Error(`Tool ${tool.name} does not exists`);
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

function loadJSON(path: string, throwIfMissing: boolean) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (e) {
		if (throwIfMissing || e.code !== "ENOENT") throw e;
	}
}

export async function report(config: ESBenchConfig, files: string[]) {
	const { reporters, diff } = normalizeConfig(config);

	const result = loadJSON(files[0], true) as ESBenchResult;

	for (let i = 1; i < files.length; i++) {
		const more = loadJSON(files[i], true) as ESBenchResult;
		for (const [name, suite] of Object.entries(more)) {
			(result[name] ??= []).push(...suite);
		}
	}

	const previous = diff && loadJSON(diff, false);
	for (const reporter of reporters) {
		await reporter(result, previous);
	}
}

export async function start(config: ESBenchConfig, filter: FilterOptions = {}) {
	const { reporters, toolchains, tempDir, diff, cleanTempDir } = normalizeConfig(config);
	const result: ESBenchResult = {};
	const startTime = performance.now();

	mkdirSync(tempDir, { recursive: true });

	const generator = new JobGenerator(tempDir, filter);
	for (const toolchain of toolchains) {
		generator.add(toolchain);
	}
	await generator.build();
	const jobs = Array.from(generator.getJobs());

	if (jobs.length === 0) {
		return console.warn("\nNo suite to run, check your CLI parameters.");
	}
	const count = jobs.reduce((s, job) => s + job.builds.length, 0);
	console.log(`\n${count} jobs for ${jobs.length} executors.`);

	for (const { executorName, executor, builds } of jobs) {
		let builder = "";
		console.log(`Running suites with: ${executorName}.`);

		await executor.start?.();
		try {
			for (const build of builds) {
				builder = build.name;

				const context = newExecuteContext(tempDir, build, filter);
				const [tcs] = await Promise.all([
					context.promise,
					executor.execute(context),
				]);

				for (const tc of tcs as any) {
					(result[tc.name] ??= []).push({
						...tc,
						builder,
						executor: executorName,
					});
				}
			}
		} catch (e) {
			console.error(`Failed to run suite with (builder=${builder}, executor=${executorName})`);
			if (e.name !== "RunSuiteError") {
				throw e;
			}
			console.error(`At scene ${e.paramStr}`);
			throw e.cause;
		} finally {
			await executor.close?.();
		}
	}

	console.log(); // Add an empty line between running & reporting phase.

	const previous = diff && loadJSON(diff, false);
	for (const reporter of reporters) {
		await reporter(result, previous);
	}

	/*
	 * We did not put the cleanup code to finally block,
	 * so that you can check the build output when error occurred.
	 */
	if (cleanTempDir) {
		try {
			rmSync(tempDir, { recursive: true });
		} catch (e) {
			console.error(e); // It's ok to keep running.
		}
	}

	const timeUsage = performance.now() - startTime;
	console.log(`Global total time: ${durationFmt.formatMod(timeUsage, "ms")}.`);
}

function newExecuteContext(tempDir: string, build: BuildResult, filter: FilterOptions) {
	const { files, root } = build;
	const pattern = resolveRE(filter.name).source;
	let resolve: (value: ToolchainResult[]) => void;
	let fail!: (reason?: Error) => void;

	const promise = new Promise<ToolchainResult[]>((resolve1, reject1) => {
		resolve = resolve1;
		fail = reject1;
	});

	function dispatch(message: ClientMessage) {
		if (Array.isArray(message)) {
			resolve(message);
		} else if ("e" in message) {
			fail(deserializeError(message.e));
		} else {
			consoleLogHandler(message.level, message.log);
		}
	}

	return { tempDir, pattern, files, root, dispatch, fail, promise } as ExecuteOptions;
}
