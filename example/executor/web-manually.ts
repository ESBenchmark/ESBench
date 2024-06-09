import { createServer, IncomingMessage, Server, ServerResponse } from "http";
import { json } from "stream/consumers";
import { once } from "events";
import { readFileSync } from "fs";
import { join } from "path";
import { ExecuteOptions, Executor } from "esbench/host";

const html = readFileSync(join(import.meta.dirname, "web-manually-client.html"), "utf8");
const loader = readFileSync(join(import.meta.dirname, "web-manually-client.js"), "utf8");

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

	async handleRequest(request: IncomingMessage, response: ServerResponse) {
		const [path] = request.url!.split("?", 2);

		if (path === "/") {
			response.writeHead(200).end(html);
		} else if (path === "/_es-bench/loader.js") {
			response.writeHead(200, { "Content-Type": "text/javascript" });
			response.end(loader);
		} else if (!this.task) {
			response.writeHead(404).end();
		} else if (path === "/_es-bench/task") {
			response.end(JSON.stringify({
				files: this.task.files,
				pattern: this.task.pattern,
				entry: `/index.js?cache-busting=${Math.random()}`,
			}));
		} else if (path === "/_es-bench/message") {
			const message = await json(request) as any;
			response.end();
			this.task.dispatch(message);
			if (!("level" in message)) {
				this.task = undefined;
			}
		} else {
			try {
				const data = readFileSync(join(this.task.root, path));
				if (path.endsWith("js")) {
					response.writeHead(200, { "Content-Type": "text/javascript" });
				}
				response.end(data);
			} catch (e) {
				response.writeHead(404).end();
			}
		}
	}

	async start() {
		this.server = createServer(this.handleRequest.bind(this));
		this.server.listen(this.port, this.host);
		await once(this.server, "listening");

		const addr = this.server.address();
		const url = `http://localhost:${addr.port}`;
		console.info("[WebManuallyExecutor] URL: " + url);
	}

	close() {
		this.server.close();
	}

	execute(options: ExecuteOptions) {
		this.task = options;
	}
}
