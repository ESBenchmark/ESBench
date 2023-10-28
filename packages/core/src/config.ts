import { Awaitable, identity } from "@kaciras/utilities/node";
import { ESBenchResult } from "./client/collect.js";
import NodeEngine from "./engine/node.js";
import { BenchmarkEngine, Builder } from "./stage.js";
import noBuild from "./builder/default.js";
import consoleReporter from "./reporter/console.js";

export interface Stage {
	builder?: Builder;
	engines?: BenchmarkEngine[];
}

export type Reporter = (result: ESBenchResult) => Awaitable<unknown>;

export interface ESBenchConfig {
	include: string[];
	stages?: Stage[];
	reporters?: Reporter[];

	tempDir?: string;
	cleanTempDir?: boolean;
}

export const defineConfig = identity<ESBenchConfig>;

export type NormalizedESConfig = ESBenchConfig & {
	tempDir: string;
	cleanTempDir: boolean;
	reporters: Reporter[];
	stages: Array<Required<Stage>>;
}

export function normalizeConfig(config: ESBenchConfig) {
	config.stages ??= [];

	for (const stage of config.stages) {
		stage.builder ??= noBuild;
		stage.engines ??= [new NodeEngine()];

		if (stage.engines.length === 0) {
			throw new Error("No engines.");
		}
	}

	config.tempDir ??= ".esbench-tmp";
	config.cleanTempDir ??= true;
	config.reporters ??= [consoleReporter()];

	return config as NormalizedESConfig;
}
