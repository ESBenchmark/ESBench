import * as http from "http";
import { IncomingMessage, Server, ServerResponse } from "http";
import * as https from "https";
import { json } from "stream/consumers";
import { once } from "events";
import { createReadStream, readFileSync } from "fs";
import { join, resolve } from "path";
import { AddressInfo } from "net";
import { env, execArgv } from "process";
import { fileURLToPath, pathToFileURL } from "url";
import * as tsDirectly from "ts-directly";
import * as importParser from "es-module-lexer";
import { ClientMessage } from "../connect.js";
import { ExecuteOptions, Executor } from "../host/toolchain.js";
import { HostContext } from "../host/index.js";

function hasFlag(flag: string) {
	return execArgv.includes(flag) || env.NODE_OPTIONS?.includes(flag);
}

function parseV8Stack(line: string) {
	const i = line.lastIndexOf("(");
	if (i === -1) {
		return ["", line.slice(7)];
	}
	return [line.slice(7, i - 1), line.slice(i + 1, -1)];
}

function parseJSCStack(line: string) {
	const i = line.indexOf("@");
	return [line.slice(0, i), line.slice(i + 1)];
}

/**
 * ESBench's builtin module transformer, used for processing files to make them
 * executable in browser. it performs:
 *
 * - Compile TS code to JS code.
 * - Resolve file imports to absolute path.
 *
 * This transformer can work with builders.
 * To enable the transformer in Node, you need a flag `--experimental-import-meta-resolve`.
 */
export const transformer = {
	// Bun has `Bun.resolveSync`, but it's not compatibility with playwright.
	enabled: hasFlag("--experimental-import-meta-resolve"),

	/**
	 * Get the file path of the import, or undefined if resolving is
	 * disabled or the request is not created by import statement.
	 *
	 * @param root The root folder of the page.
	 * @param path The pathname of the request.
	 */
	parse(root: string, path: string) {
		if (!this.enabled) {
			return;
		}
		if (path.startsWith("/@fs/")) {
			return path.slice(5);
		} else if (path === "/index.js") {
			return join(root, path);
		}
	},

	/**
	 * Read the file, and perform necessary transformation if possible.
	 *
	 * If the file does not exists, it will throw an Error with the code "ENOENT".
	 *
	 * @param path Path of the file.
	 * @return Transformed data, or undefined if the file does not need to be transformed.
	 */
	async load(path: string) {
		if (!/\.[cm]?[jt]sx?$/.test(path)) {
			return;
		}
		let code = readFileSync(path, "utf8");

		if (/tsx?$/.test(path)) {
			code = (await tsDirectly.transform(code, path, "module")).source;
		}
		return this.transformImports(code, path);
	},

	// Require `--experimental-import-meta-resolve`
	resolve(specifier: string, parent: string) {
		return fileURLToPath(import.meta.resolve(specifier, parent));
	},

	// NOTE: Breaks the source map.
	transformImports(code: string, filename: string) {
		// Currently `import.meta.resolve` does not work well with URL parent.
		const importer = pathToFileURL(filename).toString();
		const [imports] = importParser.parse(code);

		for (let i = imports.length - 1; i >= 0; i--) {
			const { n, t, s, e } = imports[i];
			if (!n) {
				continue;
			}
			let path = this.resolve(n, importer);
			path = `/@fs/${path.replaceAll("\\", "/")}`;

			const trim = t === 2 ? 1 : 0;
			code = code.slice(0, s + trim) + path + code.slice(e - trim);
		}
		return code;
	},

	/**
	 * Convert stack of the error to Node format, and resolve locations to files.
	 *
	 * @param error The Error-like object
	 * @param origin The origin of path that error thrown, no tail slash.
	 * @param root Path of the site root directory.
	 */
	fixStack(error: any, origin: string, root: string) {
		const { name, message, stack } = error;
		const lines = stack.split("\n") as string[];
		let newStack = "";
		let parse: typeof parseV8Stack;

		if (lines[0].includes("@")) {
			parse = parseJSCStack;
		} else {
			lines.splice(0, 1);
			parse = parseV8Stack;
		}

		for (let i = 0; i < lines.length; i++) {
			let [fn, pos] = parse(lines[i]);
			if (!pos) {
				continue;
			}
			if (pos.startsWith(origin)) {
				pos = pos.slice(origin.length + 1);

				if (this.enabled && pos.startsWith("@fs/")) {
					pos = pos.slice(4);
				} else {
					pos = resolve(root, pos);
				}
			}
			if (fn) {
				fn = fn.replace("*", " ");
				newStack += `\n    at ${fn} (${pos})`;
			} else {
				newStack += `\n    at ${pos}`;
			}
		}

		error.stack = `${name}: ${message}${newStack}`;

		if (error.cause) {
			this.fixStack(error.cause, origin, root);
		}
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

// https://developer.mozilla.org/en-US/docs/Web/API/Performance/now#security_requirements
export const isolationHeaders = {
	"Cross-Origin-Opener-Policy": "same-origin",
	"Cross-Origin-Embedder-Policy": "require-corp",
};

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
		const { name, message, stack } = e;
		return postMessage({ e: { name, message, stack } });
	}
}

for (let imported = false; ; sleep(5)) {
	try {
		const response = await fetch("./_es-bench/task");
		if (!response.ok) {
			continue;
		}
		// Refresh the page to clear module cache.
		if (imported) {
			location.reload();
		}
		const { entry, files, pattern } = await response.json();
		const module = await doImport(entry);
		
		imported = true;
		await module.default(postMessage, files, pattern);
	} catch {
		// ESBench finished, still poll for the next run.
	}
}`;

function resolveUrl(server: Server, options: WebRemoteExecutorOptions) {
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

interface WebRemoteExecutorOptions extends https.ServerOptions {
	/**
	 * The host parameter of `Server.listen`.
	 */
	host?: string;

	/**
	 * The port parameter of `Server.listen`.
	 *
	 * @default 14715
	 */
	port?: number;
}

/**
 * Benchmark on any device that has HTTP access to the machine!
 */
export default class WebRemoteExecutor implements Executor {

	private server!: Server;
	private task?: ExecuteOptions;

	private readonly options: WebRemoteExecutorOptions;

	/**
	 * Create a new WebRemoteExecutor instance, if `options.key`
	 * is set, it will create an HTTPS server.
	 */
	constructor(options: WebRemoteExecutorOptions = {}) {
		this.options = options;
	}

	get name() {
		return "web remote";
	}

	async start(ctx: HostContext) {
		const listener = this.handleRequest.bind(this);

		this.server = this.options.key
			? https.createServer(this.options, listener)
			: http.createServer(this.options, listener);

		const { host, port = 14715 } = this.options;
		this.server.listen(port, host);
		await once(this.server, "listening");

		const url = resolveUrl(this.server, this.options);
		ctx.info("[WebManuallyExecutor] Waiting for connection to: " + url);
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
				return response.writeHead(200, isolationHeaders).end(html);
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
			if ("e" in message) {
				const protocol = this.options.key ? "https" : "http";
				const origin = `${protocol}://${request.headers.host}`;
				transformer.fixStack(message.e, origin, root);
			}
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

		const resolved = transformer.parse(root, path);
		if (!resolved) {
			return this.sendFile(join(root, path), response);
		}

		try {
			const body = await transformer.load(resolved);
			if (body) {
				const headers = { "Content-Type": "text/javascript" };
				return response.writeHead(200, headers).end(body);
			} else {
				return this.sendFile(resolved, response);
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
