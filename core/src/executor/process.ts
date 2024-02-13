import { ChildProcess, exec } from "child_process";
import { once } from "events";
import { createServer, Server } from "http";
import { json } from "stream/consumers";
import { AddressInfo } from "net";
import { basename, join, relative } from "path";
import { writeFileSync } from "fs";
import { ExecuteOptions, Executor } from "../host/toolchain.js";

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
	private dispatch!: (message: any) => void;

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
		const command = this.getCommand("<file>");

		const file = command.charCodeAt(0) === 34
			? /"(.+?)(?<!\\)"/.exec(command)?.[1]
			: command.slice(0, command.indexOf(" ") + 1);

		return file ? basename(file) : command;
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
		this.process.kill();
		this.server.close();
	}

	async execute(options: ExecuteOptions) {
		const { tempDir, root, files, pattern, dispatch } = options;
		const { getCommand } = this;

		this.dispatch = dispatch;
		const info = this.server.address() as AddressInfo;
		const address = `http://localhost:${info.port}`;

		// relative() from path/posix also uses system-depend slash.
		const specifier = relative(tempDir, join(root, "index.js"))
			.replaceAll("\\", "/");

		const loaderCode = template
			.replace("__FILES__", JSON.stringify(files))
			.replace("__PATTERN__", JSON.stringify(pattern))
			.replace("__ADDRESS__", JSON.stringify(address))
			.replace("__ENTRY__", "./" + specifier);

		// No need to make the filename unique because only one executor can run at the same time.
		const script = join(tempDir, "main.js");
		writeFileSync(script, loaderCode);

		const command = getCommand(script);
		this.process?.kill();
		this.process = exec(command);

		const [code] = await once(this.process, "exit");
		if (code !== 0) {
			throw new Error(`Execute Failed (${code}), Command: ${command}`);
		}
	}
}
