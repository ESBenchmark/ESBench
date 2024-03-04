import { env } from "process";
import { fileURLToPath, pathToFileURL } from "url";
import { join } from "path";
import { ChildProcess, fork } from "child_process";
import { setPriority } from "os";
import { ExecuteOptions, Executor } from "../host/toolchain.js";

// Must resolve the filename to generated JS for test.
let __filename = fileURLToPath(import.meta.url);
__filename = join(__filename, "../../../lib/executor/node.js");

/**
 * This class is used to support legacy Node without the fetch API.
 */
export default class NodeExecutor implements Executor {

	private readonly executable?: string;
	private readonly args: string[];

	private process?: ChildProcess;

	/**
	 * Create a new executor that runs suites with Node.
	 *
	 * @param executable Path of the Node executable file.
	 * @param args List of string arguments passed to the executable.
	 */
	constructor(executable?: string, args: string[] = []) {
		this.executable = executable;
		this.args = args;
	}

	get name() {
		return "node";
	}

	close() {
		this.process?.kill();
	}

	execute({ root, files, pattern, dispatch, reject }: ExecuteOptions) {
		this.process?.kill();

		this.process = fork(__filename, {
			execArgv: this.args,
			stdio: "ignore",
			execPath: this.executable,
			env: {
				...env,
				ES_BENCH_WORKER: "true",
			},
		});
		this.process.on("spawn", () => {
			setPriority(this.process!.pid!, -20);
		});
		this.process.on("message", dispatch);
		this.process.send({ root, pattern, files });
		this.process.on("exit", code => {
			if (code !== 0) {
				const args = JSON.stringify(this.args);
				reject(new Error(`Node execute Failed (${code}), args=${args}`));
			}
		});
	}
}

if (env.ES_BENCH_WORKER === "true") {
	const postMessage = process.send!.bind(process);

	process.once("message", async (message: any) => {
		const { root, pattern, files } = message;

		const module = pathToFileURL(join(root, "index.js"));
		const client = await import(module.toString());

		await client.default(postMessage, files, pattern);
	});
}
