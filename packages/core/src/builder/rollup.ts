import { rollup, RollupOptions } from "rollup";
import { build, InlineConfig, mergeConfig, Plugin } from "vite";
import { Builder } from "../host/toolchain.js";

const entryId = "./index.js";

const template = `\
import { connect } from "esbench";

const suites = {__IMPORTS__\n};

function doImport(file) {
	return suites[file]();
}

export default function (channel, files, name) {
	return connect(channel, doImport, files, name);
}`;

function createEntry(files: string[]) {
	let imports = "";
	for (const file of files) {
		imports += `\n\t"${file}": () => import("${file}"),`;
	}
	return template.replace("__IMPORTS__", imports);
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
			if (id === entryId) {
				return createEntry(files);
			}
		},
	};
}

const defaults: InlineConfig = {
	logLevel: "error",
	build: {
		target: "esnext",
		minify: false,
		modulePreload: false,
	},
};

export class RollupBuilder implements Builder {

	private readonly config: RollupOptions;

	readonly name: string;

	constructor(name = "Rollup", config: RollupOptions = {}) {
		this.name = name;
		this.config = config;
	}

	async build(dir: string, files: string[]) {
		let plugins = (await this.config.plugins) || [];
		if (!Array.isArray(plugins)) {
			plugins = [plugins];
		}
		const bundle = await rollup({
			...this.config,
			preserveEntrySignatures: "strict",
			input: entryId,
			plugins: [...plugins, entryPlugin(files)],
		});
		await bundle.write({ ...this.config.output, dir });
		await bundle.close();
	}
}

export class ViteBuilder implements Builder {

	private readonly config: InlineConfig;

	readonly name: string;

	constructor(name = "Vite", config: InlineConfig = {}) {
		this.name = name;
		this.config = mergeConfig(defaults, config);
	}

	async build(outDir: string, files: string[]) {
		await build(mergeConfig(this.config, {
			build: {
				outDir,
				rollupOptions: {
					preserveEntrySignatures: "strict",
					input: entryId,
					output: {
						entryFileNames: "[name].js",
					},
				},
			},
			plugins: [entryPlugin(files)],
		}));
	}
}
