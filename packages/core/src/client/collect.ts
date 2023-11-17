import { cartesianObject } from "@kaciras/utilities/browser";
import { Metrics, WorkloadResult } from "./runner.js";

export type ESBenchResult = Record<string, StageResult[]>;

export interface StageResult {
	engine?: string;
	builder?: string;
	paramDef: Record<string, string[]>;
	scenes: WorkloadResult[][];
}

export interface FlattedResult {
	engine?: string;
	builder?: string;
	name: string;
	metrics: Metrics;
	params: Record<string, string>;
}

export function flatSummary(value: StageResult[]) {
	const list: FlattedResult[] = [];
	const pKeys = new Set();
	const builders = new Set();
	const engines = new Set();

	for (const { engine, builder, paramDef, scenes } of value) {
		const paramsIter = cartesianObject(paramDef)[Symbol.iterator]();
		builders.add(builder);
		engines.add(engine);
		for (const key of Object.keys(paramDef)) {
			pKeys.add(key);
		}

		for (const scene of scenes) {
			const params = paramsIter.next().value;
			for (const { name, metrics } of scene) {
				list.push({ name, engine, builder, metrics, params });
			}
		}
	}

	return { list, builders, engines, pKeys };
}
