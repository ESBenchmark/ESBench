import { Awaitable } from "@kaciras/utilities/browser";
import { deserializeError, ErrorObject, serializeError } from "serialize-error";
import { LogHandler, LogLevel } from "./profiling.js";
import { BenchmarkSuite } from "./suite.js";
import { runSuite, RunSuiteOption, RunSuiteResult } from "./runner.js";

export interface ToolchainResult extends RunSuiteResult {
	builder?: string;
	executor?: string;
}

export type ESBenchResult = Record<string, ToolchainResult[]>;

type ErrorMessage = { e: ErrorObject; params?: string };

type LogMessage = { log?: string; level: LogLevel };

/**
 * Some types of objects that need to be sent to the host.
 *
 * How to detect the type:
 * - Array.isArray(message): it is a RunSuiteResult array.
 * - "e" in message: it's an ErrorMessage.
 * - "level" in message: it's a LogMessage.
 */
export type ClientMessage = RunSuiteResult[] | ErrorMessage | LogMessage;

/**
 * A function that load benchmark suites. Provided by builders.
 */
export type Importer = (path: string) => Awaitable<{ default: BenchmarkSuite }>;

/**
 * A function that post messages to the host. Provided by executors.
 *
 * Log messages are sent multiple times, others are sent only once.
 *
 * If you implement an executor that does not support continuous transmission
 * of messages, you can ignore logs.
 */
export type Channel = (message: ClientMessage) => Awaitable<void>;

/**
 * Import and run suites, then send the results over the channel.
 *
 * @param postMessage Function used to transfer the results to the host.
 * @param importer Function to import a suite, normally provided by builder.
 * @param files Paths of suite files.
 * @param pattern A Regexp string for filter benchmark cases by name.
 */
export async function runAndSend(
	postMessage: Channel,
	importer: Importer,
	files: string[],
	pattern?: string,
) {
	const option: RunSuiteOption = {
		log: (log, level) => postMessage({ level, log }),
		pattern: pattern ? new RegExp(pattern) : undefined,
	};

	const results: RunSuiteResult[] = [];
	try {
		for (const file of files) {
			postMessage({ level: "info", log: `\nSuite: ${file}` });
			const mod = await importer(file);
			results.push(await runSuite(mod.default, option));
		}
		return postMessage(results);
	} catch (e) {
		return postMessage({ e: serializeError(e) });
	}
}

/**
 * A helper to deal with runner messages, forward messages to `dispatch`
 * and then you can wait for the promise to finish runs.
 *
 * @param onLog function to handle log messages.
 */
export function messageResolver(onLog: LogHandler) {
	let resolve!: (value: ToolchainResult[]) => void;
	let reject!: (reason?: Error) => void;

	const promise = new Promise<ToolchainResult[]>((s, j) => {
		resolve = s;
		reject = j;
	});

	function dispatch(message: ClientMessage) {
		if (Array.isArray(message)) {
			resolve(message);
		} else if ("e" in message) {
			reject(deserializeError(message.e));
		} else {
			onLog(message.log, message.level);
		}
	}

	return { promise, resolve, reject, dispatch };
}
