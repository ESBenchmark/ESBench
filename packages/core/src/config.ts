import { fileReporter, Reporter } from "./report.js";
import NodeRunner from "./engine/node.js";
import { nopBuilder } from "./builder/nop.js";
import { BenchmarkEngine, Builder } from "./stage.js";

export interface Stage {
	builder?: Builder;
	engines?: BenchmarkEngine[];
}

export interface ESBenchConfig {
	include: string[];
	stages?: Stage[];
	reporters?: Reporter[];

	tempDir?: string;
	cleanTempDir?: boolean;
}

export type NormalizedESConfig = ESBenchConfig & {
	tempDir: string;
	cleanTempDir: boolean;
	reporters: Reporter[];
	stages: Array<Required<Stage>>;
}

export function normalizeConfig(config: ESBenchConfig) {
	config.stages ??= [];

	for (const scene of config.stages) {
		scene.builder ??= nopBuilder;
		scene.engines ??= [new NodeRunner()];

		if (scene.engines.length === 0) {
			throw new Error("No engines.");
		}
	}

	config.tempDir ??= ".esbench-tmp";
	config.cleanTempDir ??= true;
	config.reporters ??= [fileReporter()];

	return config as NormalizedESConfig;
}
