import { build, InlineConfig, mergeConfig, Plugin } from "vite";
import { ProcessContext, Processor } from "./processor.js";

const ENTRY_ID = "./ESBench_Main.js";

const mainCode = `
import runSuite from "@esbench/core/src/core.js";

const suites = {__IMPORTS__\n};

export default function (file, name, channel) {
	return runSuite(suites[file](), name, channel);
}`;

function createEntry(files: string[]) {
	let imports = "";
	for (const file of files) {
		imports += `\n\t"${file}": () => import("${file}"),`;
	}
	return mainCode.replace("__IMPORTS__", imports);
}

function vitePlugin(files: string[]): Plugin {
	return {
		name: "ESBench-entry",
		resolveId(id) {
			if (id === ENTRY_ID) {
				return ENTRY_ID;
			}
		},
		load(id) {
			if (id === ENTRY_ID) {
				return createEntry(files);
			}
		},
	};
}

const defaults: InlineConfig = {
	build: {
		target: "esnext",
		minify: false,
		modulePreload: false,
		rollupOptions: {
			preserveEntrySignatures: "strict",
			input: ENTRY_ID,
			output: {
				entryFileNames: "[name].js",
			},
		},
	},
};

export default class ViteProcessor implements Processor {

	private readonly config: InlineConfig;

	readonly name: string;

	constructor(config: InlineConfig) {
		this.name = "Vite";
		this.config = mergeConfig(defaults, config);
	}

	process(ctx: ProcessContext) {
		const config = mergeConfig(this.config, {
			build: {
				outDir: ctx.tempDir(),
			},
			plugins: [
				vitePlugin(ctx.files),
			],
		});
		return build(config).then(() => ENTRY_ID);
	}
}
