import { Awaitable } from "@kaciras/utilities/browser";
import { deserializeError, ErrorObject, serializeError } from "serialize-error";
import { LogHandler, LogType } from "./profiling.js";
import { UserSuite } from "./suite.js";
import { runSuite, RunSuiteOption, RunSuiteResult } from "./runner.js";

/**
 * The host side will add some attributes to the result.
 */
export interface ToolchainResult extends RunSuiteResult {
	name?: string;
	builder?: string;
	executor?: string;
}

/**
 * Key is name of the suite file, must be valid for path.
 * Value is results of the suite in all toolchains.
 */
export type ESBenchResult = Record<string, ToolchainResult[]>;

type ErrorMessage = { e: ErrorObject; params?: string };

type LogMessage = { log?: string; level: LogType };

/**
 * Some types of objects that need to be sent to the host.
 *
 * How to detect the type:
 * - "e" in message: it's an ErrorMessage.
 * - "level" in message: it's a LogMessage.
 * - else it is a ToolchainResult.
 */
export type ClientMessage = RunSuiteResult | ErrorMessage | LogMessage;

/**
 * A function that load benchmark suites. Provided by builders.
 */
export type Importer = (path: string) => Awaitable<{ default: UserSuite }>;

/**
 * A function that post messages to the host. Provided by executors.
 *
 * It will be used to send multiple log messages, and send a results message
 * or an error object at the end. If you implement an executor that does not
 * support continuous transmission, you can ignore logs.
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
	file: string,
	pattern?: string,
) {
	const option: RunSuiteOption = {
		log: (log, level) => postMessage({ level, log }),
		pattern: pattern ? new RegExp(pattern) : undefined,
	};
	try {
		const { default: suite } = await importer(file);
		if (file.startsWith("./")) {
			file = file.slice(2);
		}
		postMessage({ level: "info", log: `\nSuite: ${file}` });
		const result = await runSuite(suite, option) as ToolchainResult;

		result.name = file;
		return postMessage(result);
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
	let resolve!: (value: ToolchainResult) => void;
	let reject!: (reason?: Error) => void;

	const promise = new Promise<ToolchainResult>((s, j) => {
		resolve = s;
		reject = j;
	});

	function dispatch(message: ClientMessage) {
		if ("scenes" in message) {
			resolve(message);
		} else if ("e" in message) {
			reject(deserializeError(message.e));
		} else {
			onLog(message.log, message.level);
		}
	}

	return { promise, resolve, reject, dispatch };
}
