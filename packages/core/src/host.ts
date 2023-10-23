import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path/posix";
import { performance } from "perf_hooks";
import glob from "fast-glob";
import { durationFmt, MultiMap } from "@kaciras/utilities/node";
import { BenchmarkEngine } from "./stage.js";
import { ESBenchConfig, normalizeConfig, NormalizedESConfig } from "./config.js";
import { ClientMessage, ESBenchResult, ResultCollector } from "./client/index.js";

interface Build {
	name: string;
	root: string;
	entry: string;
}

export class ESBench {

	private readonly config: NormalizedESConfig;

	constructor(options: ESBenchConfig) {
		this.config = normalizeConfig(options);
	}

	async run(pattern?: RegExp) {
		const { include, stages, reporters, tempDir, cleanTempDir } = this.config;
		const startTime = performance.now();

		mkdirSync(tempDir, { recursive: true });
		const files = await glob(include);
		const map = new MultiMap<BenchmarkEngine, Build>();

		for (const { builder, engines } of stages) {
			const root = mkdtempSync(join(tempDir, "build-"));

			console.log(`Building with ${builder.name}...`);
			const entry = await builder.build({ root, files });

			for (const engine of engines) {
				map.add(engine, { entry, name: builder.name, root });
			}
		}

		const result: ESBenchResult = {};

		for (const [engine, builds] of map) {
			const engineName = await engine.start();
			console.log(`Running suites on ${engineName}.`);

			for (const { name, root, entry } of builds) {
				const collector = new ResultCollector(result, engineName, name);

				const handleMessage = (message: ClientMessage) => {
					if ("log" in message) {
						console.log(message.log);
					} else {
						collector.collect(message.file, message.result);
					}
				};

				await engine.run({
					tempDir, root, entry, files, pattern: pattern?.source, handleMessage,
				});
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
