import { build, Plugin, Rollup } from "vite";

const VMID = "ESBench_Main.js";

const mainCode = `
import runSuites from "@esbench/core/src/core.js";

const suites = { __IMPORTS__ };

runSuites(suites, __NAME__, $SEND_MESSAGE);
`;

function createEntry(files: string[], name: string) {
	let imports = "";
	for (const file of files) {
		imports += `\n\t"${file}": () => import("/${file}"),`;
	}
	return mainCode
		.replace("__IMPORTS__", imports)
		.replace("__NAME__", JSON.stringify(name));
}

function vitePlugin(files: string[], name: string): Plugin {
	return {
		name: "ESBench-entry",
		resolveId(id) {
			if (id === VMID)
				return VMID;
		},
		load(id) {
			if (id !== VMID) {
				return;
			}
			return createEntry(files, name);
		},
	};
}

export class ViteAdapter {

	private bundle!: Rollup.RollupOutput;

	constructor() {

	}

	async start(files: string[]) {
		this.bundle = await build({
			build: {
				rollupOptions: {
					input: VMID,
					output: {
						entryFileNames: "[name].js",
					},
				},
				write: false,
			},
			plugins: [
				vitePlugin(files, "TODO"),
			],
		});
	}

	async importModule(specifier: string) {
		specifier = specifier.slice(1);
		const r = this.bundle.output.find(c => c.fileName === specifier);
		if (r) {
			return r.code;
		}
		throw new Error("Can not load module: " + specifier);
	}
}
