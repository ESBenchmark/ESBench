import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join, relative } from "path";
import { cwd } from "process";
import { performance } from "perf_hooks";
import glob from "fast-glob";
import { durationFmt, MultiMap } from "@kaciras/utilities/node";
import { Builder, Engine, RunOptions } from "./stage.js";
import { ESBenchConfig, normalizeConfig, NormalizedConfig } from "./config.js";
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

export class ESBenchHost {

	private readonly config: NormalizedConfig;

	readonly result: ESBenchResult = {};

	constructor(config: ESBenchConfig) {
		this.config = normalizeConfig(config);
	}

	async build(file?: string) {
		const { tempDir, stages } = this.config;
		const engineMap = new MultiMap<Engine, Builder>();
		const builderMap = new MultiMap<Builder, string>();

		mkdirSync(tempDir, { recursive: true });

		for (const { include, builders, engines } of stages) {
			const dotGlobs = include.map(dotPrefixed);
			for (const builder of builders) {
				builderMap.add(builder, ...dotGlobs);
				engineMap.distribute(engines, builder);
			}
		}

		const assetMap = new Map<Builder, Build>();
		for (const [builder, include] of builderMap) {
			const root = mkdtempSync(join(tempDir, "build-"));
			const { name } = builder;

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
			console.log(`Building with ${name}...`);
			await builder.build(root, files);
			assetMap.set(builder, { files, name, root });
		}

		const jobs = new MultiMap<Engine, Build>();
		for (const [engine, builders] of engineMap) {
			for (const builder of builders) {
				const builds = assetMap.get(builder);
				if (builds) {
					jobs.add(engine, builds);
				}
			}
		}
		return jobs;
	}

	private onMessage(engine: string, builder: string, message: ClientMessage) {
		if ("level" in message) {
			consoleLogHandler(message.level, message.log);
		} else {
			const { name, ...rest } = message;
			(this.result[name] ??= []).push({ engine, builder, ...rest });
		}
	}

	async run(file?: string, nameRegex?: RegExp) {
		const { reporters, tempDir, cleanTempDir } = this.config;
		const startTime = performance.now();

		if (file) {
			file = relative(cwd(), file);
			file = dotPrefixed(file.replaceAll("\\", "/"));
		}

		const jobs = await this.build(file);

		if (jobs.size === 0) {
			throw new Error("No file matching the include pattern of stages");
		}
		console.log(`${jobs.count} stages for ${jobs.size} engines.`);

		const context: Partial<RunOptions> = {
			tempDir,
			pattern: nameRegex?.source,
		};

		for (const [engine, builds] of jobs) {
			const engineName = await engine.start();
			console.log(`Running suites with: ${engineName}.`);

			for (const { files, name, root } of builds) {
				context.handleMessage = this.onMessage.bind(this, engineName, name);
				context.files = files;
				context.root = root;
				await engine.run(context as RunOptions);
			}

			await engine.close();
		}

		console.log(); // Add an empty line between running & reporting phase.

		for (const reporter of reporters) {
			await reporter(this.result);
		}
		if (cleanTempDir) {
			rmSync(tempDir, { recursive: true });
		}

		const timeUsage = performance.now() - startTime;
		console.log(`Global total time: ${durationFmt.formatMod(timeUsage, "ms")}.`);
	}
}
