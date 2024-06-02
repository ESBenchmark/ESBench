import { writeFileSync } from "fs";
import { join, relative } from "path";
import { Builder } from "../host/toolchain.js";

const template = `\
import { runAndSend } from "esbench";

const doImport = file => import("__ROOT__" + file.slice(1));

export default function (channel, files, name) {
	return runAndSend(channel, doImport, files, name);
}`;

/**
 * Although no code transformation is needed, it is still necessary
 * to create an entry module according to ESBench conventions.
 */
export default <Builder>{
	name: "None",
	build(outDir: string) {
		const root = relative(outDir, process.cwd());
		const code = template.replace("__ROOT__", root.replaceAll("\\", "/"));
		writeFileSync(join(outDir, "index.js"), code);
	},
};
