import { Awaitable, identity } from "@kaciras/utilities/node";
import { ESBenchResult } from "./client/collect.js";
import DirectEngine from "./engine/direct.js";
import { BenchmarkEngine, Builder } from "./stage.js";
import noBuild from "./builder/default.js";
import textReporter from "./reporter/text.js";

export interface Stage {
	/**
	 * The micromatch glob patterns ESBench uses to detect suite files.
	 *
	 * By default, match all JS/TS files in the ./benchmark folder.
	 */
	include?: string[];

	/**
	 * By default, it will perform no transform at all.
	 */
	builders?: Builder[];

	/**
	 * By default, it run suites directly in the current context.
	 */
	engines?: BenchmarkEngine[];
}

export type Reporter = (result: ESBenchResult) => Awaitable<unknown>;

export interface ESBenchConfig {
	/**
	 * Which files will be run as benchmark suites under which scenarios.
	 */
	stages?: Stage[];

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

export const defineConfig = identity<ESBenchConfig>;

export type NormalizedESConfig = Required<ESBenchConfig> & {
	stages: Array<Required<Stage>>;
}

export function normalizeConfig(input: ESBenchConfig) {
	if (input.stages?.length === 0) {
		throw new Error("No stages.");
	}

	const config: ESBenchConfig = {
		tempDir: ".esbench-tmp",
		cleanTempDir: true,
		reporters: [textReporter()],
		...input,
		stages: [],
	};

	for (let stage of input.stages ?? [{}]) {
		stage = {
			include: ["./benchmark/**/*.[jt]s?(x)"],
			builders: [noBuild],
			engines: [new DirectEngine()],
			...stage,
		};
		config.stages!.push(stage);

		if (stage.builders?.length === 0) {
			throw new Error("No builders.");
		}
		if (stage.engines!.length === 0) {
			throw new Error("No engines.");
		}
		if (stage.include?.length === 0) {
			throw new Error("No included files.");
		}
	}

	return config as NormalizedESConfig;
}
