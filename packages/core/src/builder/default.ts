import { writeFileSync } from "fs";
import { join, relative } from "path";
import { Builder } from "../host/toolchain.js";

const template = `\
import { connect } from "esbench";

const doImport = file => import("__ROOT__" + file.slice(1));

export default function (channel, files, name) {
	return connect(channel, doImport, files, name);
}`;

export default <Builder>{
	name: "NoBuild",
	build(outDir: string) {
		const root = relative(outDir, process.cwd());
		const code = template.replace("__ROOT__", root.replaceAll("\\", "/"));
		writeFileSync(join(outDir, "index.js"), code);
	},
};
