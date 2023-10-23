import { Awaitable } from "@kaciras/utilities/browser";
import { BenchmarkSuite } from "./suite.js";
import { SuiteResult, SuiteRunner } from "./worker.js";

export type ClientMessage = { log: string } | { file: string; result: SuiteResult };

export type Importer = (path: string) => Awaitable<{ default: BenchmarkSuite<any> }>;

export type Channel = (message: ClientMessage) => Awaitable<void>;

export async function connect(channel: Channel, importer: Importer, files: string[], name?: string) {
	for (const file of files) {
		const { default: suite } = await importer(file);
		const runner = new SuiteRunner(suite, log => channel({ log }));
		channel({ file, result: await runner.run(name) });
	}
}
