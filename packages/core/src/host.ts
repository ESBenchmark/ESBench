import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join, relative } from "path";
import { cwd } from "process";
import { performance } from "perf_hooks";
import glob from "fast-glob";
import { durationFmt, MultiMap } from "@kaciras/utilities/node";
import { BenchmarkEngine, Builder, RunOptions } from "./stage.js";
import { ESBenchConfig, normalizeConfig, NormalizedESConfig, Stage } from "./config.js";
import { ClientMessage, ESBenchResult, LogLevel } from "./client/index.js";

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

	constructor(config: ESBenchConfig) {
		this.config = normalizeConfig(config);
	}

	async buildStages(stages: Array<Required<Stage>>, outDir: string, file?: string) {
		const engineMap = new MultiMap<BenchmarkEngine, Builder>();
		const builderMap = new MultiMap<Builder, string>();

		for (const { include, builders, engines } of stages) {
			for (let i = 0; i < include.length; i++) {
				include[i] = dotPrefixed(include[i]);
			}
			for (const builder of builders) {
				builderMap.add(builder, ...include);
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

		const map = new MultiMap<BenchmarkEngine, Build>();
		for (const [engine, builders] of engineMap) {
			for (const builder of builders) {
				const builds = assetMap.get(builder);
				if (builds) {
					map.add(engine, ...builds);
				}
			}
		}
		return map;
	}

	async run(file?: string, nameRegex?: RegExp) {
		const { stages, reporters, tempDir, cleanTempDir } = this.config;
		const startTime = performance.now();

		if (file) {
			file = relative(cwd(), file);
			file = dotPrefixed(file.replaceAll("\\", "/"));
		}

		mkdirSync(tempDir, { recursive: true });
		const map = await this.buildStages(stages, tempDir, file);

		if (map.size === 0) {
			throw new Error("No file matching the include pattern of stages");
		}
		console.log(`${map.count} stages for ${map.size} engines.`);

		const result: ESBenchResult = {};
		const context: Partial<RunOptions> = {
			tempDir,
			pattern: nameRegex?.source,
		};

		function setHandler(engine: string, builder: string) {
			context.handleMessage = (message: ClientMessage) => {
				if ("level" in message) {
					const method = LogLevel[message.level] as keyof typeof LogLevel;
					if (message.log) {
						console[method](message.log);
					} else {
						console[method]();
					}
				} else {
					const { name, scenes, paramDef } = message;
					(result[name] ??= []).push({
						scenes, paramDef, engine, builder,
					});
				}
			};
		}

		for (const [engine, builds] of map) {
			const engineName = await engine.start();
			console.log(`Running suites with: ${engineName}.`);

			for (const { files, name, root } of builds) {
				setHandler(engineName, name);
				context.files = files;
				context.root = root;
				await engine.run(context as RunOptions);
			}

			await engine.close();
		}

		console.log(); // Add an empty line between running & reporting phase.

		for (const reporter of reporters) {
			await reporter(result);
		}
		if (cleanTempDir) {
			rmSync(tempDir, { recursive: true });
		}

		const timeUsage = performance.now() - startTime;
		console.log(`Global total time: ${durationFmt.formatMod(timeUsage, "ms")}.`);
	}
}
