import { Awaitable } from "@kaciras/utilities/node";

export interface Builder {

	name: string;

	build(outDir: string, files: string[]): Awaitable<string>;
}

export interface RunOptions {
	tempDir: string;
	root: string;
	entry: string;
	files: string[];
	pattern?: string;

	handleMessage(message: any): void;
}

export interface BenchmarkEngine {

	start(): Awaitable<string>;

	close(): Awaitable<void>;

	run(options: RunOptions): Awaitable<unknown>;
}
