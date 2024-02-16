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
import { ClientMessage, ESBenchResult } from "../index.js";
import { consoleLogHandler, resolveRE, SharedModeFilter } from "../utils.js";
import noBuild from "../builder/default.js";

interface FilterOptions {
	file?: string;
	builder?: string | RegExp;
	executor?: string | RegExp;
	name?: string | RegExp;
}

interface BuildResult {
	name: string;
	root: string;
	files: string[];
}

export class JobGenerator {

	readonly nameMap = new Map<any /* Builder | Executor */, string>();

	private readonly builderMap = new MultiMap<Builder, string>();
	private readonly executorPattern = new MultiMap<Executor, string>();
	private readonly executorMap = new MultiMap<Executor, Builder>();
	private readonly assetMap = new Map<Builder, BuildResult>();

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
			this.builderMap.add(builderUsed, ...dotGlobs);
			this.executorMap.distribute(ue, builderUsed);
		}

		for (const executor of ue) {
			this.executorPattern.add(executor, ...dotGlobs);
		}
	}

	async build(shared?: string) {
		const { directory, assetMap, nameMap } = this;
		let { file } = this.filter;

		if (file) {
			file = relative(cwd(), file).replaceAll("\\", "/");
		}

		const sharedFilter = SharedModeFilter.parse(shared);

		for (const [builder, include] of this.builderMap) {
			const name = nameMap.get(builder)!;
			let files = sharedFilter.select(await glob(include));
			if (file) {
				files = files.filter(p => p.includes(file!));
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
			assetMap.set(builder, { name, root, files });
		}
	}

	getJobs() {
		const jobs = new MultiMap<Executor, BuildResult>();
		for (const [executor, builders] of this.executorMap) {
			const isMatch = picomatch(this.executorPattern.get(executor)!);
			for (const builder of builders) {
				const builds = this.assetMap.get(builder);
				if (!builds) {
					continue;
				}
				const files = builds.files.filter(p => isMatch(normalize(p)));
				if (files.length > 0) {
					jobs.add(executor, { ...builds, files });
				}
			}
		}
		return jobs;
	}

	getName(tool: Builder | Executor) {
		const name = this.nameMap.get(tool);
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

		const n = this.nameMap.get(tool);
		if (n !== undefined) {
			if (n === name) {
				return tool;
			}
			throw new Error(`A tool can only have one name (${n} vs ${name})`);
		}

		for (const [t, n] of this.nameMap) {
			if (t[keyMethod] === undefined) {
				continue;
			}
			if (n === name) {
				throw new Error("Each tool must have a unique name: " + name);
			}
		}
		this.nameMap.set(tool, name);
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

export async function start(config: ESBenchConfig, filter: FilterOptions = {}, shared?: string) {
	const { reporters, toolchains, tempDir, diff, cleanTempDir } = normalizeConfig(config);
	const result: ESBenchResult = {};
	const startTime = performance.now();

	mkdirSync(tempDir, { recursive: true });

	const generator = new JobGenerator(tempDir, filter);
	for (const toolchain of toolchains) {
		generator.add(toolchain);
	}
	await generator.build(shared);
	const jobs = generator.getJobs();

	if (jobs.size === 0) {
		return console.warn("\nNo suite to run, check your CLI parameters.");
	}
	console.log(`\n${jobs.count} jobs for ${jobs.size} executors.`);

	for (const [executor, builds] of jobs) {
		const name = generator.getName(executor);
		console.log(`Running suites with: ${name}.`);

		const driver = new ExecutorDriver(name, executor, result);
		await driver.execute(builds, tempDir, filter);
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

class ExecutorDriver {

	private readonly result: ESBenchResult;
	private readonly name: string;
	private readonly executor: Executor;
	private readonly monitor: Promise<void>;

	private reject!: (reason?: any) => void;
	private current!: BuildResult;

	constructor(name: string, executor: Executor, result: ESBenchResult) {
		this.result = result;
		this.name = name;
		this.executor = executor;
		this.monitor = new Promise((_, reject) => this.reject = reject);
		this.onMessage = this.onMessage.bind(this);
	}

	onMessage(message: ClientMessage) {
		const { name: executor, current: { name: builder } } = this;

		if ("e" in message) {
			console.error(`Failed to run suite with (builder=${builder}, executor=${executor})`);
			if (message.params) {
				console.error(`At scene ${message.params}`);
			}
			this.reject(deserializeError(message.e));
		} else if ("level" in message) {
			consoleLogHandler(message.level, message.log);
		} else {
			for (const result of message) {
				(this.result[result.name] ??= []).push({ executor, builder, ...result });
			}
		}
	}

	async execute(builds: BuildResult[], tempDir: string, filter: FilterOptions) {
		const { executor, monitor } = this;
		const context = <ExecuteOptions>{
			tempDir,
			pattern: resolveRE(filter.name).source,
		};

		await executor.start?.();
		try {
			for (const build of builds) {
				this.current = build;
				context.dispatch = this.onMessage;
				context.files = build.files;
				context.root = build.root;
				const task = executor.execute(context);
				await Promise.race([task, monitor]);
			}
		} finally {
			await executor.close?.();
		}
	}
}
