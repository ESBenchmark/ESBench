import { pathToFileURL } from "url";
import { resolve } from "path";
import { Awaitable } from "@kaciras/utilities/node";
import { BenchmarkSuite } from "./core.js";

export interface ProcessContext {

	files: string[];

	tempDir(): string;
}

export interface Processor {

	name: string;

	process(ctx: ProcessContext): Awaitable<string>;
}

export const nopProcessor: Processor = {
	name: "None",
	process: () => import.meta.url,
};

export default async function (channel: any, file: string, name?: string) {
	const module = pathToFileURL(resolve(file)).toString();
	const { options, mainFn } = (await import(module)).default;
	await new BenchmarkSuite(options, mainFn, channel).bench(name);
}
