import glob from "fast-glob";
import { SuiteOptions } from "./core.js";
import { NodeRunner } from "./node.js";
import consoleReporter from "./report.js";

export interface BenchmarkScript {
	default: SuiteOptions;
}

type Reporter = (result: SuiteResult) => void | Promise<void>;

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

interface RunnerResult {
	name: string;
	options: Record<string, any>;
	cases: CaseResult[];
}

interface CaseResult {
	params: Record<string, any>;
	iterations: Record<string, IterationResult[]>;
}

interface IterationResult {
	time: number;
	memory?: number;
}

export interface BenchmarkRunner {

	start(): Promise<void> | void;

	close(): Promise<void> | void;

	run(file: string, name?: string): any;
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

		await runner.start();

		const results = [];
		for (const file of await glob(files)) {
			results.push(await runner.run(file));
		}
		await runner.close();

		await reporter(results);
	}

	async run(suite: string, name: string) {

	}
}
