import { join } from "path";
import { writeFileSync } from "fs";
import { Awaitable } from "@kaciras/utilities/node";
import runSuite, { Channel } from "./worker.js";

export interface TransformContext {
	root: string;
	files: string[];
}

export interface Transformer {

	name: string;

	transform(ctx: TransformContext): Awaitable<string>;
}

export const nopTransformer: Transformer = {
	name: "None",
	transform(ctx) {
		writeFileSync(join(ctx.root, "nop-loader.js"), t);
		return "nop-loader.js";
	},
};

export default async function (channel: Channel, files: string[], name?: string) {
	for (const file of files) {
		await runSuite(channel, import("." + file), name);
	}
}

const t = `
export default async function (channel, files, name) {
	for (const file of files) {
		await runSuite(channel, import("." + file), name);
	}
}`;
