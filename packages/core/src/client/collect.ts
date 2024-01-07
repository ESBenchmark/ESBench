import { cartesianObject, firstItem, MultiMap } from "@kaciras/utilities/browser";
import { BaselineOptions } from "./suite.js";
import { CaseResult, Metrics } from "./runner.js";

export type ESBenchResult = Record<string, ToolchainResult[]>;

export interface Note {
	type: "hint" | "warn";
	text: string;
	caseId?: number;
}

export interface ToolchainResult {
	baseline?: BaselineOptions;
	executor?: string;
	builder?: string;
	paramDef: Record<string, string[]>;
	scenes: CaseResult[][];
}

// -------------------------------------------------------------

const kMetrics = Symbol("metrics");

export type FlattedResult = Record<string, string> & {
	[kMetrics]: Metrics;
	Name: string;
	Builder?: string;
	Executor?: string;
}

function shallowHashKey(obj: any, keys: string[]) {
	return keys.map(k => `${k}=${obj[k]}`).join(",");
}

function groupBy1<T>(items: T[], callbackFn: (e: T) => string) {
	const group = new MultiMap<string, T>();
	for (const element of items) {
		group.add(callbackFn(element), element);
	}
	return group;
}

// https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy
const groupBy: typeof groupBy1 = (Map as any).groupBy ?? groupBy1;

export class SummaryTableFilter {

	readonly vars = new Map<string, Set<string>>();

	readonly table: FlattedResult[] = [];

	constructor(suiteResult: ToolchainResult[]) {
		// Ensure the Name is the first entry.
		this.vars.set("Name", new Set());

		for (const result of suiteResult) {
			this.addResult(result);
		}
	}

	private addResult(toolchain: ToolchainResult) {
		const { executor, builder, paramDef, scenes } = toolchain;
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
