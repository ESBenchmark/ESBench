import { fileURLToPath } from "url";
import { InitializeHook, LoadHook } from "module";

let compile: (code: string, filename: string) => string | Promise<string>;

async function tryImport(module: string) {
	try {
		return await import(module);
	} catch (e) {
		// Why there are 2 different error codes?
		if (e.code !== "ERR_MODULE_NOT_FOUND"
			&& e.code !== "MODULE_NOT_FOUND") throw e;
	}
}

function swcTransform(code: string, filename: string) {
	return this.transformSync(code, {
		filename,
		"jsc": {
			"parser": {
				"syntax": "typescript",
			},
			"target": "esnext",
		},
	});
}

async function esbuildTransform(code: string, filename: string) {
	const build = this.transformWithEsbuild;
	const output = await build(code, filename, { sourcemap: "inline" });
	return output.code;
}

function tsTransform(code: string, fileName: string) {
	const ts = this.default;
	const options = {
		fileName,
		compilerOptions: {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
			sourceMap: true,
			inlineSourceMap: true,
		},
	};
	return ts.transpileModule(code, options).outputText;
}

// noinspection JSUnusedGlobalSymbols
export const initialize: InitializeHook = async () => {
	const swc = await tryImport("@swc/core");
	if (swc) {
		return compile = swcTransform.bind(swc);
	}
	const vite = await tryImport("vite");
	if (vite) {
		return compile = esbuildTransform.bind(vite);
	}
	const esbuild = await tryImport("esbuild");
	if (esbuild) {
		return compile = esbuildTransform.bind(esbuild);
	}
	const ts = await tryImport("typescript");
	if (ts) {
		return compile = tsTransform.bind(ts);
	}
	throw new Error("Cannot find TypeScript transformer");
};

// noinspection JSUnusedGlobalSymbols
export const load: LoadHook = async (url, context, nextLoad) => {
	const tsExtension = /\.[cm]?tsx?$/.exec(url);
	if (!tsExtension) {
		return nextLoad(url, context);
	}

	const x = await nextLoad(url, { ...context, format: "ts" as any });

	const filename = fileURLToPath(url);
	const source = await compile(x.source!.toString(), filename);
	return { source, format: "module", shortCircuit: true };
};
