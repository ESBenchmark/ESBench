import chalk from "chalk";
import { logLevelPriority } from "../utils.js";
import { LogHandler } from "../profiling.js";

const colors = [chalk.cyan, chalk, chalk.yellow, chalk.redBright];

export interface HostLogger {

	handler: LogHandler;

	debug(message?: string): void;

	info(message?: string): void;

	warn(message?: string): void;

	error(message?: string): void;
}

export function createLogger(minLevel: keyof typeof logLevelPriority) {
	const priority = logLevelPriority[minLevel];

	const handler: LogHandler = (message, level) => {
		const i = logLevelPriority[level];
		if (i >= priority) {
			console[level](colors[i](message));
		}
	};

	return <HostLogger>{
		handler,
		debug: message => handler(message, "debug"),
		info: message => handler(message, "info"),
		warn: message => handler(message, "warn"),
		error: message => handler(message, "error"),
	};
}
