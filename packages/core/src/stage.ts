import { Awaitable } from "@kaciras/utilities/node";

export interface Builder {

	name: string;

	/**
	 * The entry filename must be [outDir]/index.js
	 *
	 * @param outDir
	 * @param files
	 */
	build(outDir: string, files: string[]): Awaitable<void>;
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
