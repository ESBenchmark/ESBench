import { cartesianObject, firstItem, MultiMap } from "@kaciras/utilities/browser";
import { MetricMeta, Metrics, RunSuiteResult } from "./runner.js";

export type ESBenchResult = Record<string, ToolchainResult[]>;

export interface ToolchainResult extends RunSuiteResult {
	builder?: string;
	executor?: string;
}

// -------------------------------------------------------------

const kMetrics = Symbol("metrics");

export type FlattedResult = Record<string, string> & {
	Name: string;
	Builder?: string;
	Executor?: string;

	// Retrieve by SummaryTableFilter.getMetrics
	[kMetrics]: Metrics;

	// You can assign custom value with symbol keys.
	[kCustom: symbol]: any;
}

export interface ResolvedNote {
	type: "info" | "warn";
	text: string;
	row?: FlattedResult;
}

function shallowHashKey(obj: any, keys: string[]) {
	return keys.map(k => `${k}=${obj[k]}`).join(",");
}

function groupByPolyfill<T>(items: T[], callbackFn: (e: T) => string) {
	const group = new MultiMap<string, T>();
	for (const element of items) {
		group.add(callbackFn(element), element);
	}
	return group;
}

// https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy
const groupBy: typeof groupByPolyfill = (Map as any).groupBy ?? groupByPolyfill;

export class SummaryTableFilter {

	readonly vars = new Map<string, Set<string>>();

	readonly table: FlattedResult[] = [];
	readonly notes: ResolvedNote[] = [];
	readonly meta = new Map<string, MetricMeta>();

	constructor(suiteResult: ToolchainResult[]) {
		// Ensure the Name is the first entry.
		this.vars.set("Name", new Set());

		for (const result of suiteResult) {
			this.addResult(result);
		}
	}

	private addResult(toolchain: ToolchainResult) {
		const { executor, builder, paramDef, scenes, notes } = toolchain;
		const offset = this.table.length;
		const iter = cartesianObject(paramDef)[Symbol.iterator]();

		if (builder) {
			this.addToVar("Builder", builder);
		}
		if (executor) {
			this.addToVar("Executor", executor);
		}
		for (const [key, values] of Object.entries(paramDef)) {
			this.addToVar(key, ...values);
		}

		for (const [k, v] of Object.entries(toolchain.meta)) {
			this.meta.set(k, v);
		}

		for (const scene of scenes) {
			const params = iter.next().value;
			for (const { name, metrics } of scene) {
				this.table.push({
					...params,
					Builder: builder,
					Executor: executor,
					Name: name,
					[kMetrics]: metrics,
				});
				this.addToVar("Name", name);
			}
		}

		for (const { type, text, caseId } of notes) {
			const resolved: ResolvedNote = { type, text };
			this.notes.push(resolved);
			if (caseId !== undefined) {
				resolved.row = this.table[offset + caseId];
			}
		}
	}

	private addToVar(name: string, ...values: string[]) {
		let list = this.vars.get(name);
		if (!list) {
			this.vars.set(name, list = new Set());
		}
		for (const value of values) list.add(value);
	}

	static getMetrics(result: FlattedResult) {
		return result[kMetrics];
	}

	group(ignore: string) {
		const keys = Array.from(this.vars.keys()).filter(k => k !== ignore);
		return groupBy(this.table, row => shallowHashKey(row, keys));
	}

	select(values: string[], axis: string) {
		const keys = [...this.vars.keys()];
		return this.table.filter(row =>
			keys.every((k, i) => k === axis ? true : row[k] === values[i]));
	}

	createOptions() {
		return Array.from(this.vars.values(), firstItem) as string[];
	}
}
