import { fileURLToPath, pathToFileURL } from "url";
import { resolve } from "path";
import { ChildProcess, fork } from "child_process";
import { argv, env } from "process";
import { BenchmarkSuite, CaseMessage, MessageType, TurnMessage } from "./core.js";
import { BenchmarkRunner, CaseResult, RunnerResult } from "./runner.js";

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

	run(file: string, name?: string): Promise<RunnerResult> {
		const workerEnv = { ...env, BENCHMARK_CHILD: "true" };
		const args = name ? [file, name] : [file];

		const cases: CaseResult[] = [];
		const results: RunnerResult = {
			name: "node",
			cases,
			options: {},
		};

		const child = fork(__filename, args, {
			env: workerEnv,
			execPath: this.executable,
			execArgv: ["--expose_gc"],
		});

		this.processes.push(child);

		let currentCase: CaseResult;
		child.on("message", (message: TurnMessage | CaseMessage) => {
			if (message.type === MessageType.Case) {
				currentCase = { params: message.params, iterations: {} };
				cases.push(currentCase);
			} else {
				const { name, metrics } = message;
				(currentCase.iterations[name] ??= []).push(metrics);
			}
		});

		return new Promise((resolve, reject) => child.on("exit", () => resolve(results)).on("error", reject));
	}
}

if (env.BENCHMARK_CHILD === "true") {
	const [, , file, name] = argv;

	const module = pathToFileURL(resolve(file)).toString();
	const { options, build } = (await import(module)).default;

	await new BenchmarkSuite(options, build, e => process.send!(e)).bench(name);
}
