import { fileURLToPath, pathToFileURL } from "url";
import { resolve } from "path";
import { ChildProcess, fork } from "child_process";
import { argv, env } from "process";
import { BenchmarkSuite } from "./core.js";
import { BenchmarkRunner, RunOptions } from "./runtime.js";

const __filename = fileURLToPath(import.meta.url);

export interface NodeRunnerOptions {
	parallel?: number;
	executable?: string;
}

export class NodeRunner implements BenchmarkRunner {

	private readonly executable?: string;
	private readonly parallel: number;

	private readonly processes: ChildProcess[] = [];

	constructor(options: NodeRunnerOptions = {}) {
		this.executable = options.executable;
		this.parallel = options.parallel ?? 1;
	}

	start() {}

	close() {
		this.processes.forEach(p => p.kill());
	}

	run(options: RunOptions) {
		const { file, name , handleMessage } = options;
		const workerEnv = { ...env, BENCHMARK_CHILD: "true" };
		const args = name ? [file, name] : [file];

		const child = fork(__filename, args, {
			env: workerEnv,
			execPath: this.executable,
			execArgv: ["--expose_gc"],
		});

		child.on("message", handleMessage);

		this.processes.push(child);

		return new Promise<void>((resolve, reject) => child.on("exit", resolve).on("error", reject));
	}
}

if (env.BENCHMARK_CHILD === "true") {
	const [, , file, name] = argv;

	const module = pathToFileURL(resolve(file)).toString();
	const { options, build } = (await import(module)).default;

	await new BenchmarkSuite(options, build, e => process.send!(e)).bench(name);
}
