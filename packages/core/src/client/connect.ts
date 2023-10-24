import { Awaitable } from "@kaciras/utilities/browser";
import { BenchmarkSuite } from "./suite.js";
import { runSuite, RunSuiteOption, SuiteResult } from "./runner.js";

export type ClientMessage = { log: string } | { file: string; result: SuiteResult };

export type Importer = (path: string) => Awaitable<{ default: BenchmarkSuite<any> }>;

export type Channel = (message: ClientMessage) => Awaitable<void>;

export async function connect(channel: Channel, importer: Importer, files: string[], regex?: string) {
	const option: RunSuiteOption = {
		logger: log => channel({ log }),
		pattern: regex ? new RegExp(regex) : undefined,
	};

	for (const file of files) {
		const { default: suite } = await importer(file);
		channel({ file, result: await runSuite(suite, option) });
	}
}
