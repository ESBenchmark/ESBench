import { Awaitable } from "@kaciras/utilities/browser";
import { BenchmarkSuite } from "./suite.js";
import { runSuite, RunSuiteOption, RunSuiteResult } from "./runner.js";

export enum LogLevel {
	error = 5,
	warn = 4,
	info = 3,
	debug = 2,
}

export type ClientMessage = RunSuiteResult | {
	log: string;
	level: LogLevel;
};

export type Importer = (path: string) => Awaitable<{ default: BenchmarkSuite<any> }>;

export type Channel = (message: ClientMessage) => Awaitable<void>;

export async function connect(channel: Channel, importer: Importer, files: string[], regex?: string) {
	const option: RunSuiteOption = {
		logger: {
			warn: log => channel({ log, level: LogLevel.warn }),
			info: log => channel({ log, level: LogLevel.info }),
			debug: log => channel({ log, level: LogLevel.debug }),
		},
		pattern: regex ? new RegExp(regex) : undefined,
	};

	try {
		for (const file of files) {
			const { default: suite } = await importer(file);
			channel(await runSuite(suite, option));
		}
	} catch (e) {
		channel({ log: `Suite execution failed: ${e.message}`, level: LogLevel.error });
	}
}
