import { ChildProcess, execFile } from "node:child_process";
import { once } from "node:events";
import { createServer, Server } from "node:http";
import { json } from "node:stream/consumers";
import { AddressInfo } from "node:net";
import { writeFileSync } from "node:fs";
import { setPriority } from "node:os";
import { basename, relative } from "node:path";
import { join } from "node:path/posix";
import { buildCLI, splitCLI } from "@kaciras/utilities/node";
import { Executor, SuiteTask } from "../host/toolchain.js";
import { HostContext } from "../host/context.js";

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
	protected tempDir!: string;

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

	start(host: HostContext) {
		this.tempDir = host.config.tempDir;
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

	execute(task: SuiteTask) {
		this.dispatch = task.dispatch;
		this.process?.kill();

		// No need to make the filename unique because only one executor can run at the same time.
		const entry = join(this.tempDir, "main.js");
		const code = this.createEntry(task);
		writeFileSync(entry, code);

		const command = this.getCommand(entry);
		const [file, ...args] = splitCLI(command);
		this.process = execFile(file, args, {
			env: { ...process.env, ...this.env },
		});

		return this.postprocess(task);
	}

	/**
	 * Get the code of the entry file that process will execute.
	 */
	protected createEntry(task: SuiteTask) {
		const { root, file, pattern } = task;
		const { server, tempDir } = this;

		const info = server.address() as AddressInfo;
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
	protected postprocess(task: SuiteTask) {
		this.process.on("spawn", () => highestPriority(this.process.pid!));
		this.process.on("exit", code => {
			if (code !== 0) {
				const cmd = buildCLI(...this.process.spawnargs);
				task.reject(new Error(`Execute Failed (${code}), Command: ${cmd}`));
			}
		});
	}
}
