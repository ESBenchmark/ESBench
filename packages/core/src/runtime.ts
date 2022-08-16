import glob from "fast-glob";
import { CaseMessage, MessageType, SuiteOptions, TurnMessage } from "./core.js";
import { NodeRunner } from "./node.js";
import consoleReporter from "./report.js";
import { Awaitable } from "./utils.js";

export interface BenchmarkScript {
	default: SuiteOptions;
}

type Reporter = (result: SuiteResult[]) => void | Promise<void>;

export interface RunnerOptions {
	files: string[];
	runner?: BenchmarkRunner;
	reporter?: Reporter;
}

interface Metrics {
	unit: string;
}

export interface SuiteResult {
	file: string;
	metrics: Record<string, Metrics>;
	runners: RunnerResult[];
}

export interface RunnerResult {
	name: string;
	options: Record<string, any>;
	cases: CaseResult[];
}

export interface CaseResult {
	params: Record<string, any>;
	iterations: Record<string, IterationResult[]>;
}

interface IterationResult {
	time: number;
	memory?: number;
}

export interface RunOptions {
	file: string;
	name?: string;

	handleMessage(message: any): void;
}

export interface BenchmarkRunner {

	start(): Awaitable<void>;

	close(): Awaitable<void>;

	run(options: RunOptions): Awaitable<void>;
}

export class BenchmarkTool {

	private readonly options: RunnerOptions;

	constructor(options: RunnerOptions) {
		this.options = options;
	}

	async runSuites(files: string[]) {
		const {
			runner = new NodeRunner(),
			reporter = consoleReporter(),
		} = this.options;

		const suiteResults: SuiteResult[] = [];
		await runner.start();

		for (const file of await glob(files)) {
			const cases: CaseResult[] = [];
			const results: RunnerResult = {
				name: "node",
				cases,
				options: {},
			};
			let currentCase: CaseResult;
			
			await runner.run({
				file, 
				name: undefined,
				handleMessage(message:  TurnMessage | CaseMessage) {
					if (message.type === MessageType.Case) {
						currentCase = { params: message.params, iterations: {} };
						cases.push(currentCase);
					} else {
						const { name, metrics } = message;
						(currentCase.iterations[name] ??= []).push(metrics);
					}
				},
			});

			suiteResults.push({
				file,
				runners: [results],
				metrics: {
					time: { unit: "ms" },
				},
			});
		}

		await runner.close();
		await reporter(suiteResults);
	}

	async run(suite: string, name: string) {

	}
}
