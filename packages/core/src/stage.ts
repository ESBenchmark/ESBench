import { Awaitable } from "@kaciras/utilities/node";

export interface Builder {

	name: string;

	/**
	 * Transform the files needed for the benchmark.
	 * The path of the generated entry must be [outDir]/index.js
	 *
	 * @param outDir The directory in which all generated chunks should be placed.
	 * @param files Suite file paths relative to cwd.
	 */
	build(outDir: string, files: string[]): Awaitable<void>;
}

export interface RunOptions {
	tempDir: string;
	root: string;
	files: string[];
	pattern?: string;

	handleMessage(message: any): void;
}

export interface Executor {

	start(): Awaitable<string>;

	close(): Awaitable<void>;

	run(options: RunOptions): Awaitable<unknown>;
}
