import { ChildProcess, exec } from "child_process";
import { once } from "events";
import { createServer, Server } from "http";
import { json } from "stream/consumers";
import { AddressInfo } from "net";
import { join, relative } from "path/posix";
import { writeFileSync } from "fs";
import { Executor, RunOptions } from "../toolchain.js";

const template = `\
import connect from "__ENTRY__";

function postMessage(message) {
    return fetch(__ADDRESS__, {
        method: "POST",
        body: JSON.stringify(message),
    });
}

connect(postMessage, __FILES__, __PATTERN__);`;

type GetCommand = (file: string) => string;

/**
 * Call an external JS runtime to run suites, the runtime must support the fetch API.
 */
export default class ProcessExecutor implements Executor {

	private readonly getCommand: GetCommand;

	private process!: ChildProcess;
	private server!: Server;

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

	start() {
		return `External runtime (${this.getCommand("<file>")})`;
	}

	close() {
		this.server.close();
		this.process.kill();
	}

	run(options: RunOptions) {
		const { tempDir, root, files, pattern, handleMessage } = options;
		const { getCommand } = this;

		this.server = createServer((request, response) => {
			response.end();
			json(request).then(handleMessage);
		});

		this.server.listen();
		const info = this.server.address() as AddressInfo;
		const address = `http://localhost:${info.port}`;

		const specifier = relative(tempDir, join(root, "index.js"));

		const loaderCode = template
			.replace("__FILES__", JSON.stringify(files))
			.replace("__PATTERN__", JSON.stringify(pattern))
			.replace("__ADDRESS__", JSON.stringify(address))
			.replace("__ENTRY__", "./" + specifier);

		// No need to make the filename unique because only one executor can run at the same time.
		const script = join(tempDir, "main.js");
		writeFileSync(script, loaderCode);

		this.process?.kill();
		this.process = exec(getCommand(script));
		return once(this.process, "exit");
	}
}
