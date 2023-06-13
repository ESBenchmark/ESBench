import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path/posix";
import glob from "fast-glob";
import { cartesianObject, MultiMap } from "@kaciras/utilities/node";
import { MessageType, SuiteMessage, WorkerMessage, WorkloadMessage } from "./worker.js";
import { BenchmarkEngine } from "./stage.js";
import { ESBenchConfig, normalizeConfig, NormalizedESConfig } from "./config.js";

// =============================================================

type Metrics = Record<string, any[]>;

export interface CaseResult {
	name: string;
	transformer: string;
	engine: string;
	params: Record<string, any>;
	metrics: Metrics;
}

export type ESBenchResult = Record<string, CaseResult[]>;

class ESBenchResultCollector {

	public readonly result: ESBenchResult = {};

	private paramsIter!: Iterator<Record<string, any>>;
	private engine!: string;
	private transformer!: string;
	private file!: string;
	private params!: Record<string, any>;

	env(engine: string, transformer: string) {
		this.engine = engine;
		this.transformer = transformer;
	}

	handleMessage(message: WorkerMessage) {
		this[message.type](message as any);
	}

	suite({ paramDefs, file }: SuiteMessage) {
		this.file = file;
		this.result[file] = [];
		this.paramsIter = cartesianObject(paramDefs)[Symbol.iterator]();
	}

	finish() {}

	scene() {
		this.params = this.paramsIter.next().value;
	}

	workload({ name, metrics }: WorkloadMessage) {
		const { file, engine, transformer, params } = this;
		const suite = this.result[file];
		suite.push({ params, engine, transformer, name, metrics });
	}
}

// =============================================================

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

	async run(task?: string) {
		const { include, scenes, reporters, tempDir, cleanTempDir } = this.config;
		const files = await glob(include);

		mkdirSync(tempDir, { recursive: true });

		const map = new MultiMap<BenchmarkEngine, Build>();
		for (const scene of scenes) {
			const { transformer, engines } = scene;
			const root = mkdtempSync(join(tempDir, "build-"));

			const entry = await transformer.transform({ root, files });

			for (const engine of engines) {
				map.add(engine, { entry, name: transformer.name, root });
			}
		}

		const collector = new ESBenchResultCollector();
		const handleMessage = collector.handleMessage.bind(collector);

		for (const [engine, builds] of map) {
			const runnerName = await engine.start();

			for (const { name, root, entry } of builds) {
				collector.env(runnerName, name);
				await engine.run({
					tempDir, root, entry, files, task, handleMessage,
				});
			}

			await engine.close();
		}

		console.log(result);
		for (const reporter of reporters) {
			await reporter(result);
		}

		if (cleanTempDir) {
			rmSync(tempDir, { recursive: true });
		}
	}
}
