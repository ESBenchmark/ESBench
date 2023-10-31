import { Awaitable, identity } from "@kaciras/utilities/node";
import { ESBenchResult } from "./client/collect.js";
import DirectEngine from "./engine/direct.js";
import { BenchmarkEngine, Builder } from "./stage.js";
import noBuild from "./builder/default.js";
import consoleReporter from "./reporter/console.js";

export interface Stage {
	builder?: Builder;
	engines?: BenchmarkEngine[];
}

export type Reporter = (result: ESBenchResult) => Awaitable<unknown>;

export interface ESBenchConfig {
	include?: string[];
	stages?: Stage[];
	reporters?: Reporter[];

	tempDir?: string;
	cleanTempDir?: boolean;
}

export const defineConfig = identity<ESBenchConfig>;

export type NormalizedESConfig = ESBenchConfig & {
	include: string[];
	tempDir: string;
	cleanTempDir: boolean;
	reporters: Reporter[];
	stages: Array<Required<Stage>>;
}

export function normalizeConfig(input: ESBenchConfig) {
	if (input.stages?.length === 0) {
		throw new Error("No stages.");
	}
	if (input.include?.length === 0) {
		throw new Error("No included files.");
	}

	const config: ESBenchConfig = {
		include: ["benchmark/**/*.[jt]s?(x)"],
		tempDir: ".esbench-tmp",
		cleanTempDir: true,
		reporters: [consoleReporter()],
		...input,
		stages: [],
	};

	for (let stage of input.stages ?? [{}]) {
		stage = {
			builder: noBuild,
			engines: [new DirectEngine()],
			...stage,
		};
		config.stages!.push(stage);

		if (stage.engines!.length === 0) {
			throw new Error("No engines.");
		}
	}

	return config as NormalizedESConfig;
}
