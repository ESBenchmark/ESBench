import { Awaitable } from "@kaciras/utilities/node";

export interface BuildContext {
	root: string;
	files: string[];
}

export interface Builder {

	name: string;

	build(ctx: BuildContext): Awaitable<string>;
}

export interface RunOptions {
	tempDir: string;

	root: string;
	entry: string;

	files: string[];
	task?: string;

	handleMessage(message: any): void;
}

export interface BenchmarkEngine {

	start(): Awaitable<string>;

	close(): Awaitable<void>;

	run(options: RunOptions): Awaitable<unknown>;
}
