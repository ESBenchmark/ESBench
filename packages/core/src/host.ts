import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { join, relative } from "path";
import { cwd, stdout } from "process";
import { performance } from "perf_hooks";
import chalk from "chalk";
import glob from "fast-glob";
import { durationFmt, MultiMap } from "@kaciras/utilities/node";
import { Builder, Executor, RunOptions } from "./toolchain.js";
import { ESBenchConfig, Nameable, normalizeConfig, NormalizedConfig, ToolchainOptions } from "./config.js";
import { ClientMessage, ESBenchResult } from "./client/index.js";
import { consoleLogHandler, RE_ANY } from "./client/utils.js";

interface Build {
	name: string;
	root: string;
	files: string[];
}

function dotPrefixed(path: string) {
	return path.charCodeAt(0) === 46 ? path : "./" + path;
}

function resolveRE(pattern?: string | RegExp) {
	if (!pattern) {
		return RE_ANY;
	}
	if (pattern instanceof RegExp) {
		return pattern;
	}
	return new RegExp(pattern);
}

class SharedModeFilter {

	readonly index: number;
	readonly count: number;

	constructor(option?: string) {
		if (!option) {
			this.index = 0;
			this.count = 1;
		} else {
			const [index, count] = option.split("/", 2);
			this.count = parseInt(count);
			this.index = parseInt(index) - 1;
		}
	}

	select<T>(array: T[]) {
		const { index, count } = this;
		if (count === 1) {
			return array;
		}
		return array.filter((_, i) => i % count === index);
	}
}

class ToolchainJobGenerator {

	readonly nameMap = new Map<any, string | null>();
	readonly assetMap = new Map<Builder, Build>();
	readonly executorMap = new MultiMap<Executor, Builder>();
	readonly builderMap = new MultiMap<Builder, string>();

	readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	add(toolchain: Required<ToolchainOptions>) {
		const { include, builders, executors } = toolchain;
		const ue = executors.map(this.unwrapNameable.bind(this, "run"));

		const dotGlobs = include.map(dotPrefixed);
		for (const builder of builders) {
			const builderUsed = this.unwrapNameable("build", builder);
			this.builderMap.add(builderUsed, ...dotGlobs);
			this.executorMap.distribute(ue, builderUsed);
		}
	}

	async build(filter: FilterOptions, shared?: string) {
		const { directory, assetMap, nameMap } = this;
		let { file, builder: builderRE } = filter;

		builderRE = resolveRE(builderRE);
		if (file) {
			file = relative(cwd(), file);
			file = dotPrefixed(file.replaceAll("\\", "/"));
		}

		const sharedFilter = new SharedModeFilter(shared);

		for (const [builder, include] of this.builderMap) {
			const name = nameMap.get(builder) ?? builder.name;
			if (!builderRE.test(name)) {
				continue;
			}
			let files = await glob(include);
			if (file) {
				if (files.includes(file)) {
					files[0] = file;
					files.length = 1;
				} else {
					files.length = 0;
				}
			}
			files = sharedFilter.select(files);

			if (files.length === 0) {
				continue;
			}
			stdout.write(`Building suites with ${name}... `);

			const root = mkdtempSync(join(directory, "build-"));
			const start = performance.now();
			await builder.build(root, files);
			const time = performance.now() - start;

			console.log(chalk.greenBright(durationFmt.formatDiv(time, "ms")));
			assetMap.set(builder, { name, root, files });
		}
	}

	getJobs() {
		const jobs = new MultiMap<Executor, Build>();
		for (const [executor, builders] of this.executorMap) {
			for (const builder of builders) {
				const builds = this.assetMap.get(builder);
				if (builds) {
					jobs.add(executor, builds);
				}
			}
		}
		return jobs;
	}

	private unwrapNameable(keyMethod: string, tool: Nameable<any>) {
		let name: string | null = null;
		let unwrapped = tool;

		if (unwrapped[keyMethod] === undefined) {
			name = tool.name;
			unwrapped = tool.use;
		}

		const custom = this.nameMap.get(unwrapped);
		if (custom === undefined || custom === name) {
			this.nameMap.set(unwrapped, name);
			return unwrapped;
		}
		throw new Error("A tool can only have one name: " + custom ?? name);
	}
}

interface FilterOptions {
	file?: string;
	builder?: string | RegExp;
	executor?: string | RegExp;
	name?: string | RegExp;
}

export class ESBenchHost {

	private readonly config: NormalizedConfig;

	readonly result: ESBenchResult = {};

	constructor(config: ESBenchConfig) {
		this.config = normalizeConfig(config);
	}

	private onMessage(executor: string, builder: string, message: ClientMessage) {
		if ("level" in message) {
			consoleLogHandler(message.level, message.log);
		} else {
			const { name } = message;
			(this.result[name] ??= []).push({ executor, builder, ...message });
		}
	}

	async run(filter: FilterOptions = {}, shared?: string) {
		const { reporters, toolchains, tempDir, diff, cleanTempDir } = this.config;
		const startTime = performance.now();

		mkdirSync(tempDir, { recursive: true });

		const generator = new ToolchainJobGenerator(tempDir);
		for (const toolchain of toolchains) {
			generator.add(toolchain);
		}
		await generator.build(filter, shared);
		const jobs = generator.getJobs();

		if (jobs.size === 0) {
			throw new Error("\nNo file matching the include pattern of toolchains");
		}

		const context: Partial<RunOptions> = {
			tempDir,
			pattern: resolveRE(filter.name).source,
		};

		const executorRE = resolveRE(filter.executor);
		for (const [executor, builds] of jobs) {
			let executorName = await executor.start();
			executorName = generator.nameMap.get(executor) ?? executorName;
			if (executorRE.test(executorName)) {
				console.log(`Running suites with: ${executorName}.`);

				for (const { name, root, files } of builds) {
					context.handleMessage = this.onMessage.bind(this, executorName, name);
					context.files = files;
					context.root = root;
					await executor.run(context as RunOptions);
				}
			}
			await executor.close();
		}

		console.log(); // Add an empty line between running & reporting phase.

		const previous = diff && loadJSON(diff, false);
		for (const reporter of reporters) {
			await reporter(this.result, previous);
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
