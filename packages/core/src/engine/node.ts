import { fileURLToPath, pathToFileURL } from "url";
import { join } from "path/posix";
import { ChildProcess, fork } from "child_process";
import { env } from "process";
import { once } from "events";
import envinfo from "envinfo";
import { BenchmarkEngine, RunOptions } from "../stage.js";

const __filename = fileURLToPath(import.meta.url);

/**
 * This class is used to support legacy Node without the fetch API.
 */
export default class NodeEngine implements BenchmarkEngine {

	private readonly executable?: string;

	private process!: ChildProcess;

	constructor(executable?: string) {
		this.executable = executable;
	}

	start() {
		const workerEnv = { ...env, ES_BENCH_WORKER: "true" };
		this.process = fork(__filename, {
			env: workerEnv,
			execPath: this.executable,
			execArgv: ["--expose_gc"],
		});
		return new Promise<string>(resolve => {
			this.process.once("message", resolve);
		});
	}

	close() {
		this.process.kill();
	}

	run(options: RunOptions) {
		const { root, files, pattern, handleMessage } = options;

		this.process.removeAllListeners("message");
		this.process.on("message", handleMessage);
		this.process.send({ root, pattern, files });
		return once(this.process, "exit");
	}
}

if (env.ES_BENCH_WORKER === "true") {
	const postMessage = process.send!.bind(process);
	postMessage(envinfo.helpers.getNodeInfo());

	process.on("message", async (message: any) => {
		const { root, pattern, files } = message;

		const module = pathToFileURL(join(root, "index.js"));
		const client = await import(module.toString());

		client.default(postMessage, files, pattern);
	});
}
