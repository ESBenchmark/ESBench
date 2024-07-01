import { env, execArgv } from "process";
import { join, resolve } from "path";
import { readFileSync } from "fs";
import { fileURLToPath, pathToFileURL } from "url";
import * as tsDirectly from "ts-directly";
import * as importParser from "es-module-lexer";

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
		const importer = pathToFileURL(filename).href;
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
