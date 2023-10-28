import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path/posix";
import { performance } from "perf_hooks";
import glob from "fast-glob";
import { durationFmt, MultiMap } from "@kaciras/utilities/node";
import { BenchmarkEngine, RunOptions } from "./stage.js";
import { ESBenchConfig, normalizeConfig, NormalizedESConfig } from "./config.js";
import { ClientMessage, ESBenchResult } from "./client/index.js";

interface Build {
	name: string;
	root: string;
	entry: string;
}

export class ESBench {

	private readonly config: NormalizedESConfig;

	constructor(config: ESBenchConfig) {
		this.config = normalizeConfig(config);
	}

	async run(pattern?: RegExp) {
		const { include, stages, reporters, tempDir, cleanTempDir } = this.config;
		const startTime = performance.now();

		mkdirSync(tempDir, { recursive: true });
		const files = await glob(include);
		const map = new MultiMap<BenchmarkEngine, Build>();

		for (const { builder, engines } of stages) {
			const root = mkdtempSync(join(tempDir, "build-"));
			const { name } = builder;

			console.log(`Building with ${name}...`);
			const entry = await builder.build({ root, files });
			map.distribute(engines, { entry, name, root });
		}

		const result: ESBenchResult = {};
		const context: Partial<RunOptions> = {
			tempDir,
			files,
			pattern: pattern?.source,
		};

		function setHandler(engine: string, builder: string) {
			context.handleMessage = (message: ClientMessage) => {
				if ("log" in message) {
					console.log(message.log);
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
			console.log(`Running suites on ${engineName}.`);

			for (const { name, root, entry } of builds) {
				setHandler(engineName, name);
				context.root = root;
				context.entry = entry;
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
