import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { join } from "path/posix";
import glob from "fast-glob";
import { Awaitable, MultiMap } from "@kaciras/utilities/node";
import { cartesianProductObj } from "@kaciras/utilities/browser";
import { MessageType, WorkerMessage } from "./worker.js";
import { Reporter, saveResult } from "./report.js";
import { nopTransformer, Transformer } from "./transform.js";
import NodeRunner from "./runner/node.js";

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

	config.reporters ??= [saveResult()];

	return config as NormalizedESBenchConfig;
}

// =============================================================

interface Metrics {
	time: number[];
}

export interface CaseResult {
	name: string;
	transformer: string;
	engine: string;
	params: Record<string, any>;
	metrics: Metrics;
}

function newResultCollector() {
	const result = new MultiMap<string, CaseResult>();

	let paramsIter: Iterator<Record<string, any>>;
	let params: Record<string, any>;
	let file: string;
	let transformer: string;
	let engine: string;

	let resolve: any;
	let reject: any;

	function setEnv(t: string, r: string) {
		engine = r;
		transformer = t;
		return new Promise((resolve1, reject1) => {
			resolve = resolve1;
			reject = reject1;
		});
	}

	function handleMessage(message: WorkerMessage) {
		console.log(message);

		if (message.type === MessageType.Suite) {
			paramsIter = cartesianProductObj(message.paramDefs)[Symbol.iterator]();
			file = message.file;
		} else if (message.type === MessageType.Case) {
			params = paramsIter.next().value;
		} else if (message.type === MessageType.Turn) {
			result.add(file, {
				params,
				engine,
				transformer,
				name: message.name,
				metrics: message.metrics,
			});
		} else {
			resolve();
		}
	}

	return { result, setEnv, handleMessage };
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

	run(options: RunOptions): Awaitable<void>;
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
		const { include, scenes, reporters, tempDir = ".esbench-tmp", cleanTempDir = true } = this.config;
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

		const { result, setEnv, handleMessage } = newResultCollector();

		for (const [engine, builds] of map) {
			const runnerName = await engine.start();
			for (const { name, root, entry } of builds) {
				const p = setEnv(name, runnerName);
				await engine.run({
					tempDir, root, entry, files, task, handleMessage,
				});
				await p;
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
