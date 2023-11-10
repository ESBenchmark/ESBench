import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path/posix";
import { performance } from "perf_hooks";
import glob from "fast-glob";
import { durationFmt, MultiMap } from "@kaciras/utilities/node";
import { BenchmarkEngine, RunOptions } from "./stage.js";
import { ESBenchConfig, normalizeConfig, NormalizedESConfig } from "./config.js";
import { ClientMessage, ESBenchResult } from "./client/index.js";

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

	async run(file?: string, nameRegex?: RegExp) {
		const { stages, reporters, tempDir, cleanTempDir } = this.config;
		const startTime = performance.now();

		if (file) {
			file = dotPrefixed(file);
		}
		const map = new MultiMap<BenchmarkEngine, Build>();
		mkdirSync(tempDir, { recursive: true });

		for (const { include, builders, engines } of stages) {
			for (let i = 0; i < include.length; i++) {
				include[i] = dotPrefixed(include[i]);
			}
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
			for (const builder of builders) {
				const root = mkdtempSync(join(tempDir, "build-"));
				const { name } = builder;

				console.log(`Building with ${name}...`);
				await builder.build(root, files);
				map.distribute(engines, { files, name, root });
			}
		}

		if (map.size === 0) {
			throw new Error("No file matching the include pattern of stages");
		}
		console.log(`${map.count} stages for ${map.size} engines.`);

		const result: ESBenchResult = {};
		const context: Partial<RunOptions> = {
			tempDir,
			files,
			pattern: nameRegex?.source,
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
			console.log(`Running suites with: ${engineName}.`);

			for (const { name, root, entry } of builds) {
				setHandler(engineName, name);
				context.files = files;
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
