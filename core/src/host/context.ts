import chalk from "chalk";
import { LogHandler } from "../profiling.js";
import { ESBenchConfig, normalizeConfig, NormalizedConfig } from "./config.js";
import { ESBenchResult } from "../connect.js";
import { RE_ANY, SharedModeFilter } from "../utils.js";

export const logLevelPriority = { debug: 0, info: 1, warn: 2, error: 3, off: 4 };

export type LogLevel = keyof typeof logLevelPriority;

const colors = [chalk.cyan, chalk, chalk.yellow, chalk.redBright];

function resolveRE(pattern?: string | RegExp) {
	if (!pattern) {
		return RE_ANY;
	}
	return pattern instanceof RegExp ? pattern : new RegExp(pattern);
}

export interface FilterOptions {
	file?: string;
	builder?: string | RegExp;
	executor?: string | RegExp;
	name?: string | RegExp;
	shared?: string;
}

export interface NormalizedFilterOptions {
	file?: string;
	name: RegExp;
	builder: RegExp;
	executor: RegExp;
	shared: SharedModeFilter;
}

export class HostContext {

	readonly config: NormalizedConfig;
	readonly filter: NormalizedFilterOptions;
	readonly logHandler: LogHandler;

	previous: ESBenchResult = {};

	constructor(config: ESBenchConfig, filter: FilterOptions = {}) {
		this.config = normalizeConfig(config);
		this.filter = {
			builder: resolveRE(filter.builder),
			executor: resolveRE(filter.executor),
			file: filter.file,
			name: resolveRE(filter.name),
			shared: SharedModeFilter.parse(filter.shared),
		};

		const priority = logLevelPriority[this.config.logLevel];
		this.logHandler = (message, level) => {
			const i = logLevelPriority[level];
			if (i >= priority) {
				console[level](colors[i](message));
			}
		};
	}

	debug(message?: string) {
		this.logHandler(message, "debug");
	}

	info(message?: string) {
		this.logHandler(message, "info");
	}

	warn(message?: string) {
		this.logHandler(message, "warn");
	}

	error(message?: string) {
		this.logHandler(message, "error");
	}
}
