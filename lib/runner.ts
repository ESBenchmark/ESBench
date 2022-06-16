import glob from "fast-glob";
import { SuiteOptions } from "./core.js";
import { NodeRunner } from "./node.js";
import { reportConsole } from "./report.js";

export interface BenchmarkScript {
	default: SuiteOptions;
}

export interface RunnerOptions {
	files: string[];
	runner?: BenchmarkRunner;
	reporter?: any;
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
			reporter = reportConsole,
		} = this.options;

		await runner.start();

		const results = [];
		for (const file of await glob(files)) {
			results.push(await runner.run(file));
		}

		reporter(results);
		await runner.close();
	}

	async run(suite: string, name: string) {

	}
}
