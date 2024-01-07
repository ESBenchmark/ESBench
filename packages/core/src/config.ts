import { Awaitable, identity } from "@kaciras/utilities/node";
import { ESBenchResult } from "./client/collect.js";
import { Builder, Executor } from "./toolchain.js";
import noBuild from "./builder/default.js";
import DirectExecutor from "./executor/direct.js";
import textReporter from "./reporter/text.js";

export interface ToolchainOptions {
	/**
	 * The micromatch glob patterns ESBench uses to detect suite files.
	 *
	 * By default, match all JS/TS files in the ./benchmark folder.
	 */
	include?: string[];

	/**
	 * Specific a list of builder to transform source files before execution.
	 * Each build results as a new set of benchmarks.
	 *
	 * By default, it will perform no transform at all.
	 */
	builders?: Builder[];

	/**
	 * With executors, you specify JS runtimes that ESBench execute your suites.
	 *
	 * By default, it will run suites in the current process.
	 */
	executors?: Executor[];
}

export type Reporter = (result: ESBenchResult) => Awaitable<unknown>;

export interface ESBenchConfig {
	/**
	 * Which files will be run as benchmark suites under which scenarios.
	 */
	toolchains?: ToolchainOptions[];

	/**
	 * Choose dir that ESBench uses for mutation testing.
	 *
	 * @default ".esbench-tmp"
	 */
	tempDir?: string;

	/**
	 * Choose whether or not to clean temporary files.
	 *
	 * @default true
	 */
	cleanTempDir?: boolean;

	/**
	 * Configure reporters for processing benchmark results.
	 *
	 * @default [consoleReporter()]
	 */
	reporters?: Reporter[];
}

/**
 * Type helper to mark the object as an ESBench config.
 */
export const defineConfig = identity<ESBenchConfig>;

export type NormalizedConfig = Required<ESBenchConfig> & {
	toolchains: Array<Required<ToolchainOptions>>;
}

export function normalizeConfig(input: ESBenchConfig) {
	if (input.toolchains?.length === 0) {
		throw new Error("No toolchains.");
	}

	const config: ESBenchConfig = {
		tempDir: ".esbench-tmp",
		cleanTempDir: true,
		reporters: [textReporter()],
		...input,
		toolchains: [],
	};

	for (let toolchain of input.toolchains ?? [{}]) {
		toolchain = {
			include: ["./benchmark/**/*.[jt]s?(x)"],
			builders: [noBuild],
			executors: [new DirectExecutor()],
			...toolchain,
		};
		config.toolchains!.push(toolchain);

		if (toolchain.builders?.length === 0) {
			throw new Error("No builders.");
		}
		if (toolchain.executors!.length === 0) {
			throw new Error("No executors.");
		}
		if (toolchain.include?.length === 0) {
			throw new Error("No included files.");
		}
	}

	return config as NormalizedConfig;
}
