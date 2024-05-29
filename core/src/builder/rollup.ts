import type { RollupOptions } from "rollup";
import type { InlineConfig, Plugin } from "vite";
import { isBuiltin } from "module";
import { resolve } from "path";
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

const defaultConfig: InlineConfig = {
	logLevel: "error",
	configFile: false,
};

const libraryPreset: InlineConfig = {
	logLevel: "error",
	configFile: false,
	build: {
		rollupOptions: {
			external,
		},
		minify: false,
		target: "esnext",
		copyPublicDir: false,
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
		const { rollup } = await import("rollup");

		let plugins = (await this.config.plugins) || [];
		if (!Array.isArray(plugins)) {
			plugins = [plugins];
		}

		const bundle = await rollup({
			external,
			...this.config,
			input: entryId,
			preserveEntrySignatures: "allow-extension",
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

	private readonly config?: InlineConfig;

	/**
	 * Create a new ViteBuilder, by default it build suites in library mode,
	 * you can provide custom config.
	 *
	 * These options will be overridden in build:
	 * - build.outDir
	 * - build.rollupOptions.preserveEntrySignatures
	 * - build.rollupOptions.input
	 * - build.rollupOptions.output.entryFileNames
	 *
	 * ViteBuilder does not automatically resolve config from project root.
	 */
	constructor(config?: InlineConfig) {
		this.config = config;
	}

	get name() {
		return "Vite";
	}

	async build(outDir: string, files: string[]) {
		const { build, mergeConfig } = await import("vite");

		const config = this.config
			? mergeConfig(defaultConfig, this.config)
			: libraryPreset;

		const overrides: InlineConfig = {
			build: {
				// Vite's root may different with CWD.
				outDir: resolve(outDir),

				// Override `lib.entry` which resolves our virtual module to absolute path.
				rollupOptions: {
					preserveEntrySignatures: "allow-extension",
					input: entryId,
					output: {
						entryFileNames: "index.js",
					},
				},
			},
			plugins: [entryPlugin(files)],
		};
		await build(mergeConfig(config, overrides));
	}
}
