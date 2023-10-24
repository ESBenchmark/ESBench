import { Awaitable, identity } from "@kaciras/utilities/node";
import { fileReporter } from "./reporter/file.js";
import { ESBenchResult } from "./client/index.js";
import NodeEngine from "./engine/node.js";
import noBuild from "./builder/default.js";
import { BenchmarkEngine, Builder } from "./stage.js";

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

	for (const scene of config.stages) {
		scene.builder ??= noBuild;
		scene.engines ??= [new NodeEngine()];

		if (scene.engines.length === 0) {
			throw new Error("No engines.");
		}
	}

	config.tempDir ??= ".esbench-tmp";
	config.cleanTempDir ??= true;
	config.reporters ??= [fileReporter()];

	return config as NormalizedESConfig;
}
