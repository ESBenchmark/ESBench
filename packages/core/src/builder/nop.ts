import { writeFileSync } from "fs";
import { join } from "path";
import { Builder } from "../stage.js";

const template = `
import runSuites from "@esbench/core/src/worker.js";

const doImport = file => import("../." + file);

export default async function (channel, files, name) {
	await runSuites(channel, doImport, files, name);
}`;

export const nopBuilder: Builder = {
	name: "None",
	build(ctx) {
		writeFileSync(join(ctx.root, "nop-loader.js"), template);
		return "nop-loader.js";
	},
};
