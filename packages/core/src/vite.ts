import { build, Plugin } from "vite";
import { Processor } from "./processor.js";

const VMID = "./ESBench_Main.js";

const mainCode = `
import runSuite from "@esbench/core/src/core.js";

const suites = {__IMPORTS__\n};

export default function (file, name, channel) {
	return runSuite(suites[file](), name, channel);
}`;

function createEntry(files: string[], name: string) {
	let imports = "";
	for (const file of files) {
		imports += `\n\t"${file}": () => import("${file}"),`;
	}
	return mainCode
		.replace("__IMPORTS__", imports)
		.replace("__NAME__", JSON.stringify(name));
}

function vitePlugin(files: string[], name: string): Plugin {
	return {
		name: "ESBench-entry",
		resolveId(id) {
			if (id === VMID) {
				return VMID;
			}
		},
		load(id) {
			if (id === VMID) {
				return createEntry(files, name);
			}
		},
	};
}

export default function viteProcessor(): Processor {
	return  async (ctx) => {
		await build({
			build: {
				outDir: ctx.tempDir(),
				target: "esnext",
				minify: false,
				modulePreload: false,
				rollupOptions: {
					preserveEntrySignatures: "strict",
					input: VMID,
					output: {
						entryFileNames: "[name].js",
					},
				},
			},
			plugins: [
				vitePlugin(ctx.files, "TODO"),
			],
		});
		return VMID;
	};
}
