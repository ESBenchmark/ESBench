import { Awaitable } from "@kaciras/utilities/node";

export interface Builder {

	/**
	 * Suggest a name for the builder, it will be used if no name specified from config.
	 */
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
	/**
	 * A folder where the executor can save temporal files.
	 */
	tempDir: string;

	/**
	 * Output directory of the build, can be used to resolve imports.
	 */
	root: string;

	files: string[];

	/**
	 * Run benchmark with names matching the Regex pattern.
	 */
	pattern?: string;

	handleMessage(message: any): void;
}

export interface Executor {

	start(): Awaitable<string>;

	close(): Awaitable<void>;

	run(options: RunOptions): Awaitable<unknown>;
}
