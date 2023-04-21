import { mkdirSync, mkdtempSync } from "fs";
import glob from "fast-glob";
import { Awaitable, MultiMap } from "@kaciras/utilities/node";
import { cartesianProductObj } from "@kaciras/utilities/browser";
import { MessageType, WorkerMessage } from "./worker.js";
import consoleReporter from "./report.js";
import { nopTransformer, Transformer } from "./transform.js";
import NodeRunner from "./runner/node.js";

type Reporter = (result: Map<string, CaseResult[]>) => void | Promise<void>;

export interface Scene {
	processor?: Transformer;
	runtimes?: BenchmarkRunner[];
}

export interface ESBenchConfig {
	include: string[];
	scenes?: Scene[];
	reporters?: Reporter[];
}

type NormalizedESBenchConfig = Readonly<ESBenchConfig & {
	reporters: Reporter[];
	scenes: Array<Required<Scene>>;
}>

function normalizeConfig(config: ESBenchConfig) {
	config.scenes ??= [];

	for (const scene of config.scenes) {
		scene.processor ??= nopTransformer;
		scene.runtimes ??= [new NodeRunner()];

		if (scene.runtimes.length === 0) {
			throw new Error("No runtime.");
		}
	}

	config.reporters ??= [consoleReporter()];

	return config as NormalizedESBenchConfig;
}

// =============================================================

interface Metrics {
	time: number[];
}

export interface CaseResult {
	name: string;
	transformer: string;
	runner: string;
	params: Record<string, any>;
	metrics: Metrics;
}

function newResultCollector() {
	const result = new MultiMap<string, CaseResult>();

	let paramsIter: Iterator<Record<string, any>>;
	let params: Record<string, any>;
	let file: string;
	let transformer: string;
	let runner: string;

	let resolve: any;
	let reject: any;

	function setEnv(t: string, r: string) {
		runner = r;
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
				runner,
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

export interface BenchmarkRunner {

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
		const { include, scenes, reporters } = this.config;
		const files = await glob(include);

		mkdirSync(".esbench-tmp", { recursive: true });

		const map = new MultiMap<BenchmarkRunner, Build>();
		for (const scene of scenes) {
			const { processor, runtimes } = scene;
			const root = mkdtempSync(".esbench-tmp/t");

			const entry = await processor.transform({ root, files });

			for (const runtime of runtimes) {
				map.add(runtime, { entry, name: processor.name, root });
			}
		}

		const { result, setEnv, handleMessage } = newResultCollector();

		for (const [runner, builds] of map) {
			const runnerName = await runner.start();
			for (const { name, root, entry } of builds) {
				const p = setEnv(name, runnerName);
				await runner.run({
					tempDir: ".esbench-tmp", root,
					entry, files, task, handleMessage,
				});
				await p;
			}
			await runner.close();
		}

		console.log(result);

		// for (const dir of tempDirs) {
		// 	rmSync(dir, { recursive: true });
		// }

		for (const reporter of reporters) {
			// 	await reporter(suiteResults);
		}
	}
}
