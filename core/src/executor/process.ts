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

function postMessage(message) {
    return fetch(__ADDRESS__, {
        method: "POST",
        body: JSON.stringify(message),
    });
}

runAndSend(postMessage, __FILES__, __PATTERN__);`;

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
	 * // Will execute command: `node --jitless /path/to/your/suite.js`
	 * new ProcessExecutor("node --jitless");
	 *
	 * // Will execute command: `bun /path/to/your/suite.js --foo=bar`
	 * new ProcessExecutor(file => `bun ${file} --foo=bar`);
	 */
	constructor(command: string | GetCommand) {
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
		if (this.process.pid) {
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
		this.writeEntry(entry, options);

		const command = this.getCommand(entry);
		const [file, ...args] = splitCLI(command);
		this.process = execFile(file, args);

		return this.postprocess(options);
	}

	protected writeEntry(file: string, options: ExecuteOptions) {
		const { tempDir, root, files, pattern } = options;

		const info = this.server.address() as AddressInfo;
		const address = `http://localhost:${info.port}`;

		// relative() from path/posix also uses system-depend slash.
		const specifier = relative(tempDir, join(root, "index.js"));

		writeFileSync(file, template
			.replace("__PATTERN__", JSON.stringify(pattern))
			.replace("__ADDRESS__", JSON.stringify(address))
			.replace("__FILES__", JSON.stringify(files))
			.replace("__ENTRY__", specifier.replaceAll("\\", "/")));
	}

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
