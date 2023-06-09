import { fileReporter, Reporter } from "./report.js";
import NodeRunner from "./engine/node.js";
import { nopTransformer } from "./builder/nop.js";
import { BenchmarkEngine, Builder } from "./stage.js";

export interface Scene {
	transformer?: Builder;
	engines?: BenchmarkEngine[];
}

export interface ESBenchConfig {
	include: string[];
	scenes?: Scene[];
	reporters?: Reporter[];

	tempDir?: string;
	cleanTempDir?: boolean;
}

export type NormalizedESConfig = ESBenchConfig & {
	tempDir: string;
	cleanTempDir: boolean;
	reporters: Reporter[];
	scenes: Array<Required<Scene>>;
}

export function normalizeConfig(config: ESBenchConfig) {
	config.scenes ??= [];

	for (const scene of config.scenes) {
		scene.transformer ??= nopTransformer;
		scene.engines ??= [new NodeRunner()];

		if (scene.engines.length === 0) {
			throw new Error("No engine.");
		}
	}

	config.tempDir ??= ".esbench-tmp";
	config.cleanTempDir ??= true;
	config.reporters ??= [fileReporter()];

	return config as NormalizedESConfig;
}
