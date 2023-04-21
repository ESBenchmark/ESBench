import { join } from "path";
import { writeFileSync } from "fs";
import { Awaitable } from "@kaciras/utilities/node";

export interface TransformContext {
	root: string;
	files: string[];
}

export interface Transformer {

	name: string;

	transform(ctx: TransformContext): Awaitable<string>;
}

const template = `
import runSuites from "@esbench/core/src/worker.js";

const doImport = file => import("../." + file);

export default async function (channel, files, name) {
	await runSuites(channel, doImport, files, name);
}`;

export const nopTransformer: Transformer = {
	name: "None",
	transform(ctx) {
		writeFileSync(join(ctx.root, "nop-loader.js"), template);
		return "nop-loader.js";
	},
};
