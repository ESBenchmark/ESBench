import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join, relative } from "path";
import { cwd } from "process";
import { performance } from "perf_hooks";
import glob from "fast-glob";
import { durationFmt, MultiMap } from "@kaciras/utilities/node";
import { BenchmarkEngine, Builder, RunOptions } from "./stage.js";
import { ESBenchConfig, normalizeConfig, NormalizedESConfig, Stage } from "./config.js";
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

	private readonly config: NormalizedESConfig;

	readonly result: ESBenchResult = {};

	constructor(config: ESBenchConfig) {
		this.config = normalizeConfig(config);
	}

	async build(stages: Array<Required<Stage>>, outDir: string, file?: string) {
		const engineMap = new MultiMap<BenchmarkEngine, Builder>();
		const builderMap = new MultiMap<Builder, string>();

		for (const { include, builders, engines } of stages) {
			const dotGlobs = include.map(dotPrefixed);
			for (const builder of builders) {
				builderMap.add(builder, ...dotGlobs);
				engineMap.distribute(engines, builder);
			}
		}

		const assetMap = new MultiMap<Builder, Build>();
		for (const [builder, include] of builderMap) {
			const root = mkdtempSync(join(outDir, "build-"));
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
			assetMap.add(builder, { files, name, root });
		}

		const tasks = [];
		for (const [engine, builders] of engineMap) {
			for (const builder of builders) {
				const builds = assetMap.get(builder);
				if (builds) {
					tasks.push([engine, builds]);
				}
			}
		}
		return tasks as Array<[BenchmarkEngine, Build[]]>;
	}

	private onMessage(engine: string, builder: string, message: ClientMessage) {
		if ("level" in message) {
			consoleLogHandler(message.level, message.log);
		} else {
			const { name, scenes, paramDef } = message;
			(this.result[name] ??= []).push({ scenes, paramDef, engine, builder });
		}
	}

	async run(file?: string, nameRegex?: RegExp) {
		const { stages, reporters, tempDir, cleanTempDir } = this.config;
		const startTime = performance.now();

		if (file) {
			file = relative(cwd(), file);
			file = dotPrefixed(file.replaceAll("\\", "/"));
		}

		mkdirSync(tempDir, { recursive: true });
		const tasks = await this.build(stages, tempDir, file);

		if (tasks.length === 0) {
			throw new Error("No file matching the include pattern of stages");
		}

		const stageCount = tasks.reduce((s, t) => s + t[1].length, 0);
		console.log(`${stageCount} stages for ${tasks.length} engines.`);

		const context: Partial<RunOptions> = {
			tempDir,
			pattern: nameRegex?.source,
		};

		for (const [engine, builds] of tasks) {
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
