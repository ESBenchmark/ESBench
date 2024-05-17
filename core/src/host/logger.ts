import chalk from "chalk";
import { LogHandler } from "../profiling.js";

export const logLevelPriority = { debug: 0, info: 1, warn: 2, error: 3, off: 4 };

export type LogLevel = keyof typeof logLevelPriority;

const colors = [chalk.cyan, chalk, chalk.yellow, chalk.redBright];

export interface HostLogger {

	handler: LogHandler;

	debug(message?: string): void;

	info(message?: string): void;

	warn(message?: string): void;

	error(message?: string): void;
}

export function createLogger(minLevel: LogLevel) {
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
