import { build, InlineConfig, mergeConfig, Plugin } from "vite";
import { BuildContext, Builder } from "../stage.js";

const entryId = "./ESBench_Main.js";

const template = `\
import { connect } from "@esbench/core/client";

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

function vitePlugin(files: string[]): Plugin {
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
	configFile: false,
	build: {
		target: "esnext",
		minify: false,
		modulePreload: false,
	},
};

export default class ViteBuilder implements Builder {

	private readonly config: InlineConfig;

	readonly name: string;

	constructor(name = "Vite", config: InlineConfig = {}) {
		this.name = name;
		this.config = mergeConfig(defaults, config);
	}

	build(ctx: BuildContext) {
		const config = mergeConfig(this.config, {
			build: {
				outDir: ctx.root,
				rollupOptions: {
					preserveEntrySignatures: "strict",
					input: entryId,
					output: {
						entryFileNames: "[name].js",
					},
				},
			},
			plugins: [vitePlugin(ctx.files)],
		});
		return build(config).then(() => entryId);
	}
}
