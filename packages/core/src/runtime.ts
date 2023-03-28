import { mkdtempSync } from "fs";
import { cwd } from "process";
import glob from "fast-glob";
import { Awaitable, MultiMap } from "@kaciras/utilities/node";
import { CaseMessage, TurnMessage } from "./core.js";
import consoleReporter from "./report.js";
import { nopProcessor, Processor } from "./processor.js";
import DirectRunner from "./runner/direct.js";

type Reporter = (result: SuiteResult[]) => void | Promise<void>;

export interface Scene {
	processor?: Processor;
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
		scene.processor ??= nopProcessor;
		scene.runtimes ??= [new DirectRunner()];

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
	processor: string;
	runtime: string;
	params: Record<string, any>;
	metrics: Metrics;
}

export interface SuiteResult {
	path: string;
	cases: CaseResult[];
}

// =============================================================

export interface RunOptions {
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
		const tempDirs: string[] = [];
		let currentTempDir: string;

		function tempDir() {
			const dir = mkdtempSync("ESBench-");
			tempDirs.push(dir);
			return currentTempDir = dir;
		}

		const map = new MultiMap<BenchmarkRunner, Build>();
		for (const scene of scenes) {
			const { processor, runtimes } = scene;
			currentTempDir = cwd();
			const entry = await processor.process({ tempDir, files });

			for (const runtime of runtimes) {
				map.add(runtime, {
					entry,
					name: processor.name,
					root: currentTempDir,
				});
			}
		}

		// const suiteResults: SuiteResult[] = [];
		//
		// const cases: CaseResult[] = [];
		// const results: RunnerResult = {
		// 	name: "node",
		// 	cases,
		// 	options: {},
		// };
		// let currentCase: CaseResult;
		//
		// suiteResults.push({
		// 	file,
		// 	runners: [results],
		// 	metrics: {
		// 		time: { unit: "ms" },
		// 	},
		// });

		for (const [runtime, builds] of map) {
			await runtime.start();

			for (const { name, root, entry } of builds) {
				await runtime.run({
					root, entry, files, task,
					handleMessage(message: TurnMessage | CaseMessage) {
						console.log(message);
						// if (message.type === MessageType.Case) {
						// 	currentCase = { params: message.params, iterations: {} };
						// 	cases.push(currentCase);
						// } else {
						// 	const { name, metrics } = message;
						// 	(currentCase.iterations[name] ??= []).push(metrics);
						// }
					},
				});
			}
			await runtime.close();
		}

		for (const dir of tempDirs) {
			// rmSync(dir, { recursive: true });
		}

		// for (const reporter of reporters) {
		// 	await reporter(suiteResults);
		// }
	}
}
