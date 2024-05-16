import { isBuiltin } from "module";
import { rollup, RollupOptions } from "rollup";
import { build, InlineConfig, mergeConfig, Plugin } from "vite";
import { Builder } from "../host/toolchain.js";

const entryId = "./ESBench-index.js";

const template = `\
import { runAndSend } from "esbench";

const suites = {__IMPORTS__\n};

function doImport(file) {
	return suites[file]();
}

export default function (channel, files, name) {
	return runAndSend(channel, doImport, files, name);
}`;

// https://github.com/vitejs/vite/blob/bb79c9b653eeab366dccc855713369aea9f90d8f/packages/vite/src/node/utils.ts#L99
function external(id: string) {
	return /^(?:npm|bun):/.test(id) || isBuiltin(id);
}

function entryPlugin(files: string[]): Plugin {
	return {
		name: "ESBench-entry",
		resolveId(id) {
			if (id === entryId) {
				return entryId;
			}
		},
		load(id) {
			if (id !== entryId) {
				return;
			}
			let imports = "";
			for (const file of files) {
				imports += `\n\t"${file}": () => import("${file}"),`;
			}
			return template.replace("__IMPORTS__", imports);
		},
	};
}

const defaults: InlineConfig = {
	logLevel: "error",
	configFile: false,
	build: {
		rollupOptions: {
			preserveEntrySignatures: "allow-extension",
			external,
		},
		minify: false,
		target: "esnext",
		lib: {
			entry: entryId,
			formats: ["es"],
			fileName: "index",
		},
	},
};

/**
 * Transform suites with Rollup for benchmark, you have to
 * install rollup and add a plugin to perform Node resolving.
 */
export class RollupBuilder implements Builder {

	private readonly config: RollupOptions;

	constructor(config: RollupOptions = {}) {
		this.config = config;
	}

	get name() {
		return "Rollup";
	}

	async build(dir: string, files: string[]) {
		let plugins = (await this.config.plugins) || [];
		if (!Array.isArray(plugins)) {
			plugins = [plugins];
		}

		const bundle = await rollup({
			...defaults.build!.rollupOptions,
			...this.config,
			input: entryId,
			plugins: [...plugins, entryPlugin(files)],
		});

		await bundle.write({
			...this.config.output,
			dir,
			entryFileNames: "index.js",
		});
		await bundle.close();
	}
}

/**
 * Transform suites with Rollup for benchmark, you have to install vite.
 */
export class ViteBuilder implements Builder {

	private readonly config: InlineConfig;

	constructor(config: InlineConfig = {}) {
		this.config = mergeConfig(defaults, config);
	}

	get name() {
		return "Vite";
	}

	async build(outDir: string, files: string[]) {
		const overrides: InlineConfig = {
			build: {
				outDir,
				// Override lib.entry which resolves our virtual module to absolute path.
				rollupOptions: {
					input: entryId,
					output: {
						entryFileNames: "index.js",
					},
				},
			},
			plugins: [entryPlugin(files)],
		};
		await build(mergeConfig(this.config, overrides));
	}
}
