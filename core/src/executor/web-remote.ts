import * as http from "http";
import { IncomingMessage, Server, ServerResponse } from "http";
import * as https from "https";
import { json } from "stream/consumers";
import { once } from "events";
import { createReadStream, readFileSync } from "fs";
import { join } from "path";
import { AddressInfo } from "net";
import { env, execArgv } from "process";
import { fileURLToPath, pathToFileURL } from "url";
import { CompileFn, detectTypeScriptCompiler } from "ts-directly";
import * as importParser from "es-module-lexer";
import { ClientMessage } from "../connect.js";
import { pageHTML } from "./playwright.js";
import { ExecuteOptions, Executor } from "../host/toolchain.js";

function hasFlag(flag: string) {
	return execArgv.includes(flag) || env.NODE_OPTIONS?.includes(flag);
}

export const transformer = {
	// Bun has `Bun.resolveSync`, but it's not compatibility with playwright.
	enabled: hasFlag("--experimental-import-meta-resolve"),

	compileTS: undefined as CompileFn | undefined,

	resolve(root: string, path: string) {
		if (!this.enabled) {
			return;
		}
		if (path.startsWith("/@fs/")) {
			return path.slice(5);
		} else if (path === "/index.js") {
			return join(root, path);
		}
	},

	async load(path: string) {
		if (!/\.[cm]?[jt]sx?$/.test(path)) {
			return;
		}
		let code = readFileSync(path, "utf8");

		if (/tsx?$/.test(path)) {
			this.compileTS ??= await detectTypeScriptCompiler();
			code = await this.compileTS(code, path, true);
		}
		return this.transformImports(code, path);
	},

	transformImports(code: string, filename: string) {
		// Currently `import.meta.resolve` does not work well with URL parent.
		const importer = pathToFileURL(filename).toString();
		const [imports] = importParser.parse(code);

		for (const { n, t, s, e } of imports.toReversed()) {
			if (!n) {
				continue;
			}
			// Require `--experimental-import-meta-resolve`
			let path = import.meta.resolve(n, importer);
			path = fileURLToPath(path);
			path = `/@fs/${path.replaceAll("\\", "/")}`;

			const trim = t === 2 ? 1 : 0;
			code = code.slice(0, s + trim) + path + code.slice(e - trim);
		}
		return code;
	},
};

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

async function doImport(path) {
	try {
		return await import(path);
	} catch (e) {
		const message = "The remote failed to load the module";
		return postMessage({ e: { name: "Error", message } });
	}
}

for (; ; sleep(5)) {
	try {
		const response = await fetch("./_es-bench/task");
		if (!response.ok) {
			continue;
		}
		const { entry, files, pattern } = await response.json();
		const module = await doImport(entry);
		await module.default(postMessage, files, pattern);

		// Refresh the page to clear module cache.
		location.reload();
	} catch {
		// ESBench finished, still poll for the next run.
	}
}`;

function resolveUrl(server: Server, options: WebManuallyExecutorOptions) {
	const info = server.address() as AddressInfo;
	let hostname = info.address;
	switch (hostname) {
		case "0.0.0.0":
		case "::":
		case "0000:0000:0000:0000:0000:0000:0000:0000":
			hostname = "localhost";
	}
	if (hostname.includes(":")) {
		hostname = `[${hostname}]`;
	}
	const protocol = options.key ? "https" : "http";
	return `${protocol}://${hostname}:${info.port}`;
}

interface WebManuallyExecutorOptions extends https.ServerOptions {
	host?: string;
	port?: number;
}

export default class WebRemoteExecutor implements Executor {

	private server!: Server;
	private task?: ExecuteOptions;

	private readonly options: WebManuallyExecutorOptions;

	/**
	 *
	 *
	 * If `options.key` is set, it will create a HTTPS server.
	 */
	constructor(options: WebManuallyExecutorOptions = {}) {
		this.options = options;
	}

	get name() {
		return "web remote";
	}

	async start() {
		const listener = this.handleRequest.bind(this);

		this.server = this.options.key
			? https.createServer(this.options, listener)
			: http.createServer(this.options, listener);

		const { host, port } = this.options;
		this.server.listen(port, host);
		await once(this.server, "listening");

		const url = resolveUrl(this.server, this.options);
		console.info("[WebManuallyExecutor] Waiting for connection from: " + url);
	}

	close() {
		this.server.close();
		this.server.closeAllConnections();
	}

	execute(options: ExecuteOptions) {
		this.task = options;
	}

	async handleRequest(request: IncomingMessage, response: ServerResponse) {
		const [path] = request.url!.split("?", 2);

		switch (path) {
			case "/":
				return response.writeHead(200, pageHTML.headers).end(html);
			case "/_es-bench/loader.js":
				return response
					.writeHead(200, { "Content-Type": "text/javascript" })
					.end(loader);
		}

		if (!this.task) {
			return response.writeHead(404).end();
		}
		const { root, files, pattern, dispatch } = this.task;

		if (path === "/_es-bench/message") {
			const message = await json(request) as ClientMessage;
			dispatch(message);
			if (!("level" in message)) {
				this.task = undefined; // Execution finished.
			}
			return response.writeHead(204).end();
		}
		if (path === "/_es-bench/task") {
			const body = { entry: "/index.js", files, pattern };
			return response.end(JSON.stringify(body));
		}

		const fullPath = transformer.resolve(root, path);
		if (!fullPath) {
			return this.sendFile(join(root, path), response);
		}

		try {
			const body = await transformer.load(path);
			if (body) {
				const headers = { "Content-Type": "text/javascript" };
				return response.writeHead(200, headers).end(body);
			} else {
				return this.sendFile(fullPath, response);
			}
		} catch (e) {
			if (e.code !== "ENOENT") {
				throw e;
			}
			return response.writeHead(404).end(e.message);
		}
	}

	sendFile(fullPath: string, response: ServerResponse) {
		const stream = createReadStream(fullPath);
		stream.on("open", () => {
			const headers: http.OutgoingHttpHeaders = {};
			if (fullPath.endsWith("js")) {
				headers["Content-Type"] = "text/javascript";
			}
			stream.pipe(response.writeHead(200, headers));
		});
		stream.on("error", () => response.writeHead(404).end());
	}
}
