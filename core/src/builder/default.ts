import { writeFileSync } from "fs";
import { join, relative } from "path";
import { Builder } from "../host/toolchain.js";

/**
 * Although no code transformation is needed, it is still necessary
 * to create an entry module according to ESBench conventions.
 */
export default <Builder>{
	name: "None",
	build(outDir: string, files: string[]) {
		const root = relative(outDir, process.cwd()).replaceAll("\\", "/");
		let imports = "";
		for (const file of files) {
			imports += `\n\t"${file}":()=>import("${root + file.slice(1)}"),`;
		}
		const code = `\
			import { runAndSend } from "esbench";
			
			const suites = {${imports}\n};
			
			const doImport = file => suites[file]();
			
			export default function (channel, files, pattern) {
				return runAndSend(channel, doImport, files, pattern);
			}
		`;
		writeFileSync(join(outDir, "index.js"), code);
	},
};
