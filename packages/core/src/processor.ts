import { pathToFileURL } from "url";
import { resolve } from "path";
import { Awaitable } from "@kaciras/utilities/node";
import { BenchmarkSuite } from "./core.js";

export interface ProcessContext {
	files: string[];
	tempDir(): string;
}

export type Processor = (ctx: ProcessContext) => Awaitable<string>;

export function noProcess() {
	return import.meta.url;
}

export default async function (channel: any, file: string, name?: string) {
	const module = pathToFileURL(resolve(file)).toString();
	const { options, build } = (await import(module)).default;
	await new BenchmarkSuite(options, build, channel).bench(name);
}
