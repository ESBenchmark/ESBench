import { fork } from "child_process";
import { argv, env } from "process";
import { CaseResult, Channel, runSuite } from "./core.js";
import { BenchmarkRunner } from "./runner.js";
import { fileURLToPath, pathToFileURL } from "url";
import { resolve } from "path";

const __filename = fileURLToPath(import.meta.url);

export class NodeRunner implements BenchmarkRunner {

	private readonly executable?: string;

	constructor(executable?: string) {
		this.executable = executable;
	}

	start() {}

	close() {}

	run(file: string, name?: string) {
		const args = [file];
		if (name) {
			args.push(name);
		}
		const child = fork (__filename, args, {
			execPath: this.executable,
			env: { ...env, BENCHMARK_CHILD: "true" },
		});

		const results: CaseResult[] = [];

		child.on("message", (result: CaseResult) => {
			results.push(result);

			const { name, times, iterations } = result;
			const mean = times.reduce((s, c) => s + c, 0) / times.length / iterations;
			console.debug(`${name} - Time：${mean.toFixed(2)}ms`);
		});

		return new Promise(resolve => child.on("exit", () => resolve(results)));
	}
}

class NodeProcessRunner implements Channel {

	sendMessage(message: any) {
		process.send!(message);
	}
}

if (env.BENCHMARK_CHILD === "true") {
	const [,, file, name] = argv;

	const module = pathToFileURL(resolve(file)).toString();
	const { options, build } = (await import(module)).default;
	await runSuite(options, build, new NodeProcessRunner());
}
