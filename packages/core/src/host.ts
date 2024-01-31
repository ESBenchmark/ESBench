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
import { consoleLogHandler } from "./client/utils.js";

interface Build {
	files: string[];
	name: string;
	root: string;
}

function dotPrefixed(path: string) {
	return path.charCodeAt(0) === 46 ? path : "./" + path;
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

	async build(file?: string) {
		const { directory, assetMap, nameMap } = this;
		for (const [builder, include] of this.builderMap) {
			const files = await glob(include);
			if (file) {
				if (files.includes(file)) {
					files[0] = file;
					files.length = 1;
				} else {
					files.length = 0;
				}
			}
			if (files.length === 0) {
				continue;
			}

			const name = nameMap.get(builder)!;
			stdout.write(`Building suites with ${name}... `);

			const root = mkdtempSync(join(directory, "build-"));
			const start = performance.now();
			await builder.build(root, files);
			const time = performance.now() - start;

			console.log(chalk.greenBright(durationFmt.formatDiv(time, "ms")));
			assetMap.set(builder, { files, name, root });
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

		if (typeof unwrapped[keyMethod] === "undefined") {
			name = tool.name;
			unwrapped = tool.use;
		}

		const existing = this.nameMap.get(unwrapped);
		if (existing === undefined || existing === name) {
			this.nameMap.set(unwrapped, name);
			return unwrapped;
		}
		throw new Error("A builder or executor can only have 1 name");
	}
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

	async run(file?: string, nameRegex?: RegExp) {
		const { reporters, toolchains, tempDir, diff, cleanTempDir } = this.config;
		const startTime = performance.now();

		if (file) {
			file = relative(cwd(), file);
			file = dotPrefixed(file.replaceAll("\\", "/"));
		}

		mkdirSync(tempDir, { recursive: true });

		const generator = new ToolchainJobGenerator(tempDir);
		for (const toolchain of toolchains) {
			generator.add(toolchain);
		}
		await generator.build(file);
		const jobs = generator.getJobs();

		if (jobs.size === 0) {
			throw new Error("\nNo file matching the include pattern of toolchains");
		}
		console.log(`\n${jobs.count} toolchains for ${jobs.size} executors.`);

		const context: Partial<RunOptions> = {
			tempDir,
			pattern: nameRegex?.source,
		};

		for (const [executor, builds] of jobs) {
			let executorName = await executor.start();
			executorName = generator.nameMap.get(executor) ?? executorName;
			console.log(`Running suites with: ${executorName}.`);

			for (const { files, name, root } of builds) {
				context.handleMessage = this.onMessage.bind(this, executorName, name);
				context.files = files;
				context.root = root;
				await executor.run(context as RunOptions);
			}

			await executor.close();
		}

		console.log(); // Add an empty line between running & reporting phase.

		let previous: ESBenchResult | undefined;
		try {
			const json = diff && readFileSync(diff, "utf8");
			if (json) {
				previous = JSON.parse(json);
			}
		} catch (e) {
			if (e.code !== "ENOENT") throw e;
		}

		for (const reporter of reporters) {
			await reporter(this.result, previous);
		}
		if (cleanTempDir) {
			rmSync(tempDir, { recursive: true });
		}

		const timeUsage = performance.now() - startTime;
		console.log(`Global total time: ${durationFmt.formatMod(timeUsage, "ms")}.`);
	}
}
