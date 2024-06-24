import { ChildProcess, execFile } from "child_process";
import { once } from "events";
import { createServer, Server } from "http";
import { json } from "stream/consumers";
import { AddressInfo } from "net";
import { writeFileSync } from "fs";
import { setPriority } from "os";
import { basename, relative } from "path";
import { join } from "path/posix";
import { buildCLI, splitCLI } from "@kaciras/utilities/node";
import { ExecuteOptions, Executor } from "../host/toolchain.js";

type GetCommand = (file: string) => string;

const template = `\
import runAndSend from "./__ENTRY__";

const postMessage = message => fetch(__ADDRESS__, {
	method: "POST",
	body: JSON.stringify(message),
});

runAndSend(postMessage, __FILE__, __PATTERN__);`;

export function highestPriority(pid: number) {
	try {
		setPriority(pid, -20);
	} catch (e) {
		// Access may be denied on some systems.
	}
}

/**
 * Call an external JS runtime to run suites, the runtime must support the fetch API.
 */
export default class ProcessExecutor implements Executor {

	protected readonly env?: NodeJS.ProcessEnv;
	protected readonly getCommand: GetCommand;

	protected process!: ChildProcess;
	protected server!: Server;
	protected dispatch!: (message: any) => void;

	/**
	 * Create new ProcessExecutor with a command line template.
	 *
	 * You can pass a string as argument, the entry file will append to the end,
	 * or specific a function accept the entry filename and return the command line.
	 *
	 * @example
	 * // Will execute command: `node --jitless .esbench-tmp/main.js`
	 * new ProcessExecutor("node --jitless");
	 *
	 * // Will execute command: `bun .esbench-tmp/main.js --foo=bar`
	 * new ProcessExecutor(file => `bun ${file} --foo=bar`);
	 */
	constructor(command: string | GetCommand, env?: NodeJS.ProcessEnv) {
		this.env = env;
		this.getCommand = typeof command === "function"
			? command
			: (file) => `${command} ${file}`;
	}

	get name() {
		return basename(splitCLI(this.getCommand("<file>"))[0]);
	}

	start() {
		this.server = createServer((request, response) => {
			response.end();
			return json(request).then(this.dispatch);
		});
		this.server.listen();
		return once(this.server, "listening");
	}

	close() {
		if (this.process?.pid) {
			this.process.kill();
		}
		this.server.close();
	}

	execute(options: ExecuteOptions) {
		const { tempDir, dispatch } = options;
		this.process?.kill();
		this.dispatch = dispatch;

		// No need to make the filename unique because only one executor can run at the same time.
		const entry = join(tempDir, "main.js");
		const code = this.createEntry(options);
		writeFileSync(entry, code);

		const command = this.getCommand(entry);
		const [file, ...args] = splitCLI(command);
		this.process = execFile(file, args, {
			env: { ...process.env, ...this.env },
		});

		return this.postprocess(options);
	}

	/**
	 * Get the code of the entry file that process will execute.
	 *
	 * @param options Execute options
	 */
	protected createEntry(options: ExecuteOptions) {
		const { tempDir, root, file, pattern } = options;

		const info = this.server.address() as AddressInfo;
		const address = `http://localhost:${info.port}`;

		// relative() from path/posix also uses system-depend slash.
		const specifier = relative(tempDir, join(root, "index.js"));

		return template
			.replace("__PATTERN__", JSON.stringify(pattern))
			.replace("__ADDRESS__", JSON.stringify(address))
			.replace("__FILE__", JSON.stringify(file))
			.replace("__ENTRY__", specifier.replaceAll("\\", "/"));
	}

	/**
	 * Attach error handler to the process, and set the highest priority.
	 */
	protected postprocess(options: ExecuteOptions) {
		const { reject } = options;
		this.process.on("spawn", () => highestPriority(this.process.pid!));
		this.process.on("exit", code => {
			if (code !== 0) {
				const cmd = buildCLI(...this.process.spawnargs);
				reject(new Error(`Execute Failed (${code}), Command: ${cmd}`));
			}
		});
	}
}
