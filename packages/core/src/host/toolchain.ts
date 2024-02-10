import { Awaitable } from "@kaciras/utilities/node";

/*
 * Version should not be included in the suggested name, reasons:
 * 1) The version number may be too long.
 * 2) Dependencies cloud be updated frequently, in most cases we don't care about it,
 *    but a change in the name can prevent comparisons.
 * 3) If you want to compare the performance of different versions of the tool,
 *    you should add them both to the configuration and set the name.
 */

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

export interface ExecuteOptions {
	/**
	 * A folder where the executor can save temporal files.
	 */
	tempDir: string;

	/**
	 * Output directory of the build, can be used to resolve imports.
	 */
	root: string;

	/**
	 * Paths (relative to cwd) of suite files to run.
	 */
	files: string[];

	/**
	 * Run benchmark with names matching the Regex pattern.
	 */
	pattern?: string;

	handleMessage(message: any): void;
}

export interface Executor {

	/**
	 * Suggest a name for the executor, it will be used if no name specified from config.
	 */
	name: string;

	start?(): Awaitable<void>;

	close?(): Awaitable<void>;

	run(options: ExecuteOptions): Awaitable<unknown>;
}
