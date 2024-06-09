import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import { json } from "stream/consumers";
import { once } from "events";
import { createReadStream } from "fs";
import { join } from "path";
import { AddressInfo } from "net";
import { ClientMessage } from "../connect.js";
import { ExecuteOptions, Executor } from "../host/toolchain.js";

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>ESBench Client</title>
<script type="module" src="/_es-bench/loader.js"></script>
</head>
<body></body>
</html>`;

const loader = `\
const postMessage = message => fetch("/_es-bench/message", {
	method: "POST",
	body: JSON.stringify(message),
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

for (; ; sleep(5)) {
	try {
		const response = await fetch("./_es-bench/task");
		if (!response.ok) {
			continue;
		}
		const { entry, files, pattern } = await response.json();
		const module = await import(entry);
		await module.default(postMessage, files, pattern);
	} catch {
		// ESBench finished, still poll for the next run.
	}
}`;

export default class WebManuallyExecutor implements Executor {

	private server!: Server;
	private task?: ExecuteOptions;

	private readonly host?: string;
	private readonly port?: number;

	constructor(host?: string, port?: number) {
		this.host = host;
		this.port = port;
	}

	get name() {
		return "web manually";
	}

	async start() {
		this.server = createServer(this.handleRequest.bind(this));
		this.server.listen(this.port, this.host);
		await once(this.server, "listening");

		const addr = this.server.address() as AddressInfo;
		const url = `http://${this.host ?? "localhost"}:${addr.port}`;
		console.info("[WebManuallyExecutor] URL: " + url);
	}

	close() {
		this.server.close();
	}

	execute(options: ExecuteOptions) {
		this.task = options;
	}

	async handleRequest(request: IncomingMessage, response: ServerResponse) {
		const [path] = request.url!.split("?", 2);

		switch (path) {
			case "/":
				return response.writeHead(200).end(html);
			case "/_es-bench/loader.js":
				return response
					.writeHead(200, { "Content-Type": "text/javascript" })
					.end(loader);
		}

		if (!this.task) {
			return response.writeHead(404).end();
		}

		if (path === "/_es-bench/message") {
			const message = await json(request) as ClientMessage;
			this.task.dispatch(message);
			if (!("level" in message)) {
				this.task = undefined; // Execution finished.
			}
			return response.writeHead(204).end();
		}
		if (path === "/_es-bench/task") {
			return response.end(JSON.stringify({
				pattern: this.task.pattern,
				files: this.task.files,
				entry: `/index.js?cache-busting=${Math.random()}`,
			}));
		}

		try {
			const file = join(this.task.root, path);
			if (path.endsWith("js")) {
				response.writeHead(200, {
					"Content-Type": "text/javascript",
				});
			}
			createReadStream(file).pipe(response);
		} catch (e) {
			response.writeHead(404).end(e.message);
		}
	}
}
