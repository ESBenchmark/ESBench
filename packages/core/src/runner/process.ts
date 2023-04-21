import { ChildProcess, exec } from "child_process";
import * as http from "http";
import { json } from "stream/consumers";
import { AddressInfo } from "net";
import { join, relative } from "path/posix";
import { writeFileSync } from "fs";
import { BenchmarkRunner, RunOptions } from "../runtime.js";

const template = `
import runSuites from "__ENTRY__";

function postMessage(message) {
    return fetch(__ADDRESS__, {
        method: "POST",
        body: JSON.stringify(message),
    });
}

runSuites(postMessage, __FILES__, __NAME__);
`;

type GetCommand = (file: string) => string;

export default class ProcessRunner implements BenchmarkRunner {

	private readonly getCommand: GetCommand;

	private process!: ChildProcess;
	private server!: http.Server;

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
		const { getCommand } = this;
		const { tempDir, root, entry, files, task, handleMessage } = options;

		this.server = http.createServer((request, response) => {
			json(request).then(handleMessage);
			response.end();
		});

		this.server.listen();
		const info = this.server.address() as AddressInfo;
		const address = `http://localhost:${info.port}`;

		const ee = relative(tempDir, join(root, entry));

		const loaderCode = template
			.replace("__FILES__", JSON.stringify(files))
			.replace("__NAME__", JSON.stringify(task))
			.replace("__ADDRESS__", JSON.stringify(address))
			.replace("__ENTRY__", "./" + ee);

		const script = join(tempDir, "main.js");
		writeFileSync(script, loaderCode);

		this.process?.kill();

		this.process = exec(getCommand(script));

		this.process.on("message", handleMessage);
	}
}
