import ChildProcess from "child_process";
import glob from "fast-glob";
import { CaseResult, SuiteOptions, SuiteResult } from "./core";

interface BenchmarkScript {
	default: SuiteOptions;
}

function node(file: string) {
	const childEnv = Object.assign({}, process.env);
	childEnv.BENCHMARK_CHILD = "true";

	const child = ChildProcess.fork(file, [], {
		env: childEnv,
		execArgv: ["--expose-gc"],
	});
	// child.send(configs);
	const results: CaseResult[] = [];

	child.on("message", (result: CaseResult) => {
		results.push(result);
		console.debug(`${result.name} - Time：${result.time.toFixed(2)}ms`);
	});

	return new Promise(resolve => child.on("exit", () => resolve(results)));
}

export async function runBenchmarks(pattern: string) {
	const files = await glob(pattern);

	for (const file of files) {
		const script = await import(file) as BenchmarkScript;
	}
}
