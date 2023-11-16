import { WorkloadResult } from "./runner.js";

export type ESBenchResult = Record<string, StageResult[]>;

export interface StageResult {
	engine?: string;
	builder?: string;
	paramDef: Record<string, string[]>;
	scenes: WorkloadResult[][];
}
