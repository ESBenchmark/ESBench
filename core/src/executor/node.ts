import { fileURLToPath, pathToFileURL } from "url";
import { join } from "path";
import { ChildProcess, fork, ForkOptions } from "child_process";
import { ExecuteOptions, Executor } from "../host/toolchain.js";
import { highestPriority } from "./process.js";

// Resolve the filename to generated JS for test.
let __filename = fileURLToPath(import.meta.url);
__filename = join(__filename, "../../../lib/executor/node.js");

type NodeExecutorOptions = Pick<ForkOptions, "execPath" | "execArgv" | "env">;

/**
 * Run suites in a new Node process, communicate with the host through IPC channel.
 *
 * This class aims to support legacy Node without the fetch API.
 */
export default class NodeExecutor implements Executor {

	private readonly executable?: string;
	private readonly env?: NodeJS.ProcessEnv;
	private readonly args: string[];

	private process?: ChildProcess;

	constructor(options: NodeExecutorOptions = {}) {
		this.executable = options.execPath;
		this.env = options.env;
		this.args = options.execArgv ?? [];
	}

	get name() {
		return "node";
	}

	close() {
		if (this.process?.pid) {
			this.process.kill();
		}
	}

	execute({ root, files, pattern, dispatch, reject }: ExecuteOptions) {
		this.process?.kill();

		this.process = fork(__filename, {
			execArgv: this.args,
			stdio: "ignore",
			execPath: this.executable,
			env: {
				...process.env,
				...this.env,
				ES_BENCH_WORKER: "true",
			},
		});
		this.process.on("spawn", () => highestPriority(this.process!.pid!));
		this.process.on("message", dispatch);
		this.process.send({ root, pattern, files });
		this.process.on("exit", code => {
			if (code !== 0) {
				const args = JSON.stringify(this.args);
				reject(new Error(`Node execute Failed (${code}), execArgv=${args}`));
			}
		});
	}
}

if (process.env.ES_BENCH_WORKER === "true") {
	const postMessage = process.send!.bind(process);

	process.once("message", async (message: any) => {
		const { root, pattern, files } = message;

		const module = pathToFileURL(join(root, "index.js"));
		const client = await import(module.toString());

		await client.default(postMessage, files, pattern);
	});
}
