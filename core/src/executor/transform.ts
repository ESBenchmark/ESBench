import { env, execArgv } from "node:process";
import { join, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as tsdx from "ts-directly";
import * as importParser from "es-module-lexer";
import { Awaitable, silentCall } from "@kaciras/utilities/node";

/**
 * See if the specified Node feature flag is enabled. Note that this function requires
 * argv and NODE_OPTIONS not be modified after startup.
 *
 * Node has an internal implementation, and does not export it.
 *
 * @see https://github.com/nodejs/node/blob/20aff2b6ff2ab5525e6e523aba86ab622a9329d0/lib/internal/options.js#L44
 */
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

interface TransformAdapter {

	compileTS(code: string, filename: string): Awaitable<string>;

	/**
	 * Provides a module-relative resolution function scoped to each module.
	 *
	 * Unlike Vite, if an import in the module fails to resolve, the module can still be loaded.
	 * ESBench always throw an error when reading a file that doesn't exist, not when resolving it.
	 * This allows the user to write the suite more flexibility and catch related errors.
	 *
	 * @param specifier The module specifier to resolve relative to `parent`.
	 * @param parent The absolute parent module URL to resolve from.
	 * @return A URL string for the resolved module, or undefined if the resolve failed.
	 */
	resolve(specifier: string, parent: string): string | undefined;
}

const nodeAdapter: TransformAdapter = {
	async compileTS(code: string, filename: string) {
		return (await tsdx.transform(code, filename, "module")).source;
	},
	resolve(specifier: string, parent: string) {
		// Require `--experimental-import-meta-resolve`
		return silentCall(import.meta.resolve, specifier, parent);
	},
};

/**
 * ESBench's builtin module transformer, used for processing files to make them
 * executable in browser, it performs:
 *
 * - Compile TS code to JS code.
 * - Resolve file imports to absolute path.
 *
 * This transformer should work with builders.
 *
 * @example
 * try {
 *     const parsed = transformer.parse(root, path);
 *     if (!parsed) {
 *         // Non-import request or resolving disabled.
 *         return sendFile(join(root, path));
 *     }
 *     const body = await transformer.load(parsed);
 *     if (body) {
 *         // Transformed JS module.
 *         const headers = { "Content-Type": "text/javascript" };
 *         return new Response(body, { headers });
 *     } else {
 *         // No transform needed, just send the file.
 *         return sendFile(parsed);
 *     }
 * } catch (e) {
 *     // Resolve failed, or cannot read the file.
 *     return new Response(e.message, { status: 404 });
 * }
 *
 * @see https://esbench.vercel.app/guide/toolchains#built-in-transformer
 */
export const transformer = {

	// null means transformation disabled.
	adapter: hasFlag("--experimental-import-meta-resolve") ? nodeAdapter : null,

	/**
	 * Get the file path of the import, or undefined if resolving is
	 * disabled or the request is not created by import statement.
	 *
	 * If a module specifier is invalid, it will be converted to
	 * `/@unresolvable?s=<specifier>&p=<importer>`, parsing it will throw an error.
	 *
	 * @param root The root folder of the page.
	 * @param path The pathname of the request.
	 */
	parse(root: string, path: string) {
		if (!this.adapter) {
			return;
		}
		if (path.startsWith("/@fs/")) {
			return path.slice(5);
		}
		if (path === "/index.js") {
			return join(root, path);
		}
		if (path.startsWith("/@unresolvable?")) {
			const params = new URLSearchParams(path.slice(15));
			throw new Error(`Cannot find '${params.get("s")}' imported from ${params.get("p")}`);
		}
	},

	/**
	 * Read the file, and perform necessary transformation if possible.
	 *
	 * If the file does not exist, it will throw an Error with the code "ENOENT".
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
			code = await this.adapter!.compileTS(code, path);
		}
		await importParser.init;
		return this.transformImports(code, path);
	},

	// NOTE: Breaks the source map.
	transformImports(code: string, filename: string) {
		const importer = pathToFileURL(filename).href;
		const [imports] = importParser.parse(code);

		for (let i = imports.length - 1; i >= 0; i--) {
			const { n, t, s, e } = imports[i];
			if (!n) {
				continue;
			}
			let path = this.adapter!.resolve(n, importer);

			if (!path) {
				path = `/@unresolvable?s=${n}&p=${filename}`;
			} else if (path.startsWith("file:")) {
				path = fileURLToPath(path);
				path = `/@fs/${path.replaceAll("\\", "/")}`;
			}

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

				if (this.adapter && pos.startsWith("@fs/")) {
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
