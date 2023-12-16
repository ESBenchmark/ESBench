import { cartesianObject } from "@kaciras/utilities/browser";
import { Metrics, WorkloadResult } from "./runner.js";
import { BaselineOptions } from "./suite.js";

export type ESBenchResult = Record<string, StageResult[]>;

export interface StageResult {
	baseline?: BaselineOptions;
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

export interface FlattedSummary {
	list: FlattedResult[];
	names: Set<string>;
	builders: Set<string>;
	engines: Set<string>;
	params: Record<string, Set<string>>;
}

export function flatSummary(value: StageResult[]) {
	const list: FlattedResult[] = [];
	const names = new Set<string>();
	const builders = new Set<string>();
	const engines = new Set<string>();
	const params: Record<string, Set<string>> = {};

	for (const { engine, builder, paramDef, scenes } of value) {
		const paramsIter = cartesianObject(paramDef)[Symbol.iterator]();
		if (builder) {
			builders.add(builder);
		}
		if (engine) {
			engines.add(engine);
		}
		for (const [key, values] of Object.entries(paramDef)) {
			const set = params[key] ??= new Set();
			for (const value of values) {
				set.add(value);
			}
		}
		for (const scene of scenes) {
			const params = paramsIter.next().value;
			for (const { name, metrics } of scene) {
				names.add(name);
				list.push({ name, engine, builder, metrics, params });
			}
		}
	}

	return { list,names, builders, engines, params } as FlattedSummary;
}
