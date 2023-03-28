import envinfo from "envinfo";
import { BenchmarkRunner, RunOptions } from "../runtime.js";
import runBenchmarks from "../processor.js";

export default class DirectRunner implements BenchmarkRunner {

	start() {
		return envinfo.helpers.getNodeInfo();
	}

	close() {}

	async run({ files, task, handleMessage }: RunOptions) {
		for (const file of files)
			await runBenchmarks(handleMessage, file, task);
	}
}
