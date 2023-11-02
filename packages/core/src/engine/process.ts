import { ChildProcess, exec } from "child_process";
import { once } from "events";
import { createServer, Server } from "http";
import { json } from "stream/consumers";
import { AddressInfo } from "net";
import { join, relative } from "path/posix";
import { writeFileSync } from "fs";
import { BenchmarkEngine, RunOptions } from "../stage.js";

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
export default class ProcessEngine implements BenchmarkEngine {

	private readonly getCommand: GetCommand;

	private process!: ChildProcess;
	private server!: Server;

	constructor(command: string | GetCommand) {
		this.getCommand = typeof command === "function"
			? command
			: (file) => `${command} ${file}`;
	}

	start() {
		return this.getCommand("<file>");
	}

	close() {
		this.server.close();
		this.process.kill();
	}

	run(options: RunOptions) {
		const { tempDir, root, entry, files, pattern, handleMessage } = options;
		const { getCommand } = this;

		this.server = createServer((request, response) => {
			response.end();
			json(request).then(handleMessage);
		});

		this.server.listen();
		const info = this.server.address() as AddressInfo;
		const address = `http://localhost:${info.port}`;

		const specifier = relative(tempDir, join(root, entry));

		const loaderCode = template
			.replace("__FILES__", JSON.stringify(files))
			.replace("__PATTERN__", JSON.stringify(pattern))
			.replace("__ADDRESS__", JSON.stringify(address))
			.replace("__ENTRY__", "./" + specifier);

		const script = join(tempDir, "main.js");
		writeFileSync(script, loaderCode);

		this.process?.kill();
		this.process = exec(getCommand(script));
		return once(this.process, "exit");
	}
}
