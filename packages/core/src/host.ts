import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path/posix";
import glob from "fast-glob";
import { Awaitable, cartesianObject, MultiMap } from "@kaciras/utilities/node";
import { MessageType, SuiteMessage, WorkerMessage, WorkloadMessage } from "./worker.js";
import { fileReporter, Reporter } from "./report.js";
import { nopTransformer, Transformer } from "./transform.js";
import NodeRunner from "./engine/node.js";

export interface Scene {
	transformer?: Transformer;
	engines?: BenchmarkEngine[];
}

export interface ESBenchConfig {
	include: string[];
	scenes?: Scene[];
	reporters?: Reporter[];

	tempDir?: string;
	cleanTempDir?: boolean;
}

type NormalizedESBenchConfig = Readonly<ESBenchConfig & {
	reporters: Reporter[];
	scenes: Array<Required<Scene>>;
	tempDir: string;
	cleanTempDir: boolean;
}>

function normalizeConfig(config: ESBenchConfig) {
	config.scenes ??= [];

	for (const scene of config.scenes) {
		scene.transformer ??= nopTransformer;
		scene.engines ??= [new NodeRunner()];

		if (scene.engines.length === 0) {
			throw new Error("No engine.");
		}
	}

	config.tempDir ??= ".esbench-tmp";
	config.cleanTempDir ??= true;
	config.reporters ??= [fileReporter()];

	return config as NormalizedESBenchConfig;
}

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
		switch (message.type) {
			case MessageType.Suite:
				return this.suite(message);
			case MessageType.Case:
				return this.case();
			case MessageType.Workload:
				return this.workload(message);
		}
	}

	suite({ paramDefs, file }: SuiteMessage) {
		this.file = file;
		this.result[file] = [];
		this.paramsIter = cartesianObject(paramDefs)[Symbol.iterator]();
	}

	case() {
		this.params = this.paramsIter.next().value;
	}

	workload({ name, metrics }: WorkloadMessage) {
		const { file, engine, transformer, params } = this;
		const suite = this.result[file];
		suite.push({ params, engine, transformer, name, metrics });
	}
}

// =============================================================

export interface RunOptions {
	tempDir: string;

	root: string;
	entry: string;

	files: string[];
	task?: string;

	handleMessage(message: any): void;
}

export interface BenchmarkEngine {

	start(): Awaitable<string>;

	close(): Awaitable<void>;

	run(options: RunOptions): Awaitable<unknown>;
}

interface Build {
	name: string;
	root: string;
	entry: string;
}

export class ESBench {

	private readonly config: NormalizedESBenchConfig;

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
