import { Awaitable } from "@kaciras/utilities/browser";
import { BenchmarkSuite } from "./suite.js";
import { LogLevel, runSuite, RunSuiteOption, RunSuiteResult } from "./runner.js";

export type ClientMessage = RunSuiteResult | {
	log?: string;
	level: LogLevel;
};

/**
 * A function that load benchmark suites. Provided by builders.
 */
export type Importer = (path: string) => Awaitable<{ default: BenchmarkSuite<any> }>;

/**
 * A function that post messages to the host. Provided by executors.
 */
export type Channel = (message: ClientMessage) => Awaitable<void>;

export async function connect(channel: Channel, importer: Importer, files: string[], regex?: string) {
	const option: RunSuiteOption = {
		log: (level, log) => channel({ level: level, log }),
		pattern: regex ? new RegExp(regex) : undefined,
	};

	try {
		for (const file of files) {
			const { default: suite } = await importer(file);
			channel(await runSuite(suite, option));
		}
	} catch (e) {
		channel({ log: `Suite execution failed: ${e.message}`, level: "error" });
	}
}
