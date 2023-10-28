export type ESBenchResult = Record<string, StageResult[]>;

export interface StageResult {
	engine?: string;
	builder?: string;
	paramDef: Record<string, string[]>;
	scenes: WorkloadResult[][];
}

export interface WorkloadResult {
	name: string;
	metrics: Metrics;
}

export type Metrics = Record<string, any[]>;
