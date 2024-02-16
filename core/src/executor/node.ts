import { env } from "process";
import { fileURLToPath, pathToFileURL } from "url";
import { join } from "path";
import { ChildProcess, fork } from "child_process";
import { once } from "events";
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
	private process?: ChildProcess;

	/**
	 * @param executable Path of the Node executable file.
	 */
	constructor(executable?: string) {
		this.executable = executable;
	}

	get name() {
		return "node";
	}

	close() {
		this.process?.kill();
	}

	async execute({ root, files, pattern, dispatch }: ExecuteOptions) {
		this.process = fork(__filename, {
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

		const [code] = await once(this.process, "exit");
		if (code !== 0) {
			throw new Error(`Node execute Failed (exitCode=${code})`);
		}
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
