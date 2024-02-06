import { env } from "process";
import { fileURLToPath, pathToFileURL } from "url";
import { join } from "path/posix";
import { ChildProcess, fork } from "child_process";
import { once } from "events";
import { Executor, RunOptions } from "../host/toolchain.js";

const __filename = fileURLToPath(import.meta.url);

/**
 * This class is used to support legacy Node without the fetch API.
 */
export default class NodeExecutor implements Executor {

	private readonly executable?: string;

	private process!: ChildProcess;

	/**
	 * @param executable Path of the Node executable file.
	 */
	constructor(executable?: string) {
		this.executable = executable;
	}

	get name() {
		return "node";
	}

	start() {
		const workerEnv = { ...env, ES_BENCH_WORKER: "true" };
		this.process = fork(__filename, {
			env: workerEnv,
			execPath: this.executable,
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

	process.on("message", async (message: any) => {
		const { root, pattern, files } = message;

		const module = pathToFileURL(join(root, "index.js"));
		const client = await import(module.toString());

		await client.default(postMessage, files, pattern);
	});
}
