import type { TransformOptions } from "esbuild";
import { fileURLToPath } from "url";
import { LoadHook } from "module";
import { parse, TSConfckCache } from "tsconfck";

type CompileFn = (code: string, filename: string) => string | Promise<string>;

async function swcCompiler(): Promise<CompileFn> {
	const swc = await import("@swc/core");
	const cache = new TSConfckCache<any>();

	return async (code, filename) => {
		const { tsconfig: { compilerOptions } } = await parse(filename, { cache });
		const { target = "es2022", module = "esnext" } = compilerOptions;

		const options: any = {
			filename,
			swcrc: false,
			sourceMaps: "inline",
			jsc: {
				target: target.toLowerCase(),
				parser: {
					syntax: "typescript",
					tsx: filename.endsWith("x"),
				},
			},
		};

		switch (options.jsc.target) {
			case "esnext":
			case "latest":
				options.jsc.target = "es2022";
		}

		options.module = {
			type: module.toLowerCase() === "commonjs" ? "commonjs" : "es6",
		};

		return swc.transformSync(code, options).code;
	};
}

async function viteEsbuildCompiler(): Promise<CompileFn> {
	const { transformWithEsbuild } = await import("vite");
	return async (code, filename) =>
		transformWithEsbuild(code, filename, { sourcemap: "inline" }).then(r => r.code);
}

async function esbuildCompiler(): Promise<CompileFn> {
	const { transform } = await import("esbuild");
	const cache = new TSConfckCache<any>();

	return async (code, sourcefile) => {
		const { tsconfig } = await parse(sourcefile, { cache });
		const options: TransformOptions = {
			sourcefile,
			loader: sourcefile.endsWith("x") ? "tsx" : "ts",
			sourcemap: "inline",
			tsconfigRaw: tsconfig,
		};
		return transform(code, options).then(r => r.code);
	};
}

async function tsCompiler(): Promise<CompileFn> {
	const { default: ts } = await import("typescript");
	const cache = new TSConfckCache<any>();

	return async (code, fileName) => {
		const { tsconfig: { compilerOptions } } = await parse(fileName, { cache });
		compilerOptions.sourceMap = true;
		compilerOptions.inlineSourceMap = true;

		const options = { fileName, compilerOptions };
		return ts.transpileModule(code, options).outputText;
	};
}

const compilers = [swcCompiler, viteEsbuildCompiler, esbuildCompiler, tsCompiler];

let compile: CompileFn;

async function detectTypeScriptCompiler() {
	for (const create of compilers) {
		try {
			return await create();
		} catch (e) {
			// Why are there 2 error codes for module not found?
			if (e.code !== "ERR_MODULE_NOT_FOUND"
				&& e.code !== "MODULE_NOT_FOUND") throw e;
		}
	}
	throw new Error("No TypeScript transformer found");
}

// noinspection JSUnusedGlobalSymbols
export const load: LoadHook = async (url, context, nextLoad) => {
	const tsExtension = /\.[cm]?tsx?$/.exec(url);
	if (!tsExtension) {
		return nextLoad(url, context);
	}

	const raw = await nextLoad(url, {
		...context,
		format: "ts" as any,
	});

	if (!compile) {
		compile = await detectTypeScriptCompiler();
	}

	const code = raw.source!.toString();
	const filename = fileURLToPath(url);
	const source = await compile(code, filename);

	return { source, format: "module", shortCircuit: true };
};
