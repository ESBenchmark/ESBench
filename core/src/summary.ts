import { cartesianObject, firstItem, MultiMap } from "@kaciras/utilities/browser";
import { RunSuiteResult } from "./runner.js";
import { MetricMeta, Metrics } from "./context.js";
import { BaselineOptions } from "./suite.js";

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

	// Retrieved by `Summary.getMetrics`
	[kMetrics]: Metrics;

	// You can add custom properties with symbol keys.
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

function groupByPolyfill<T>(items: Iterable<T>, callbackFn: (e: T) => string) {
	const group = new MultiMap<string, T>();
	for (const element of items) {
		group.add(callbackFn(element), element);
	}
	return group;
}

// https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy
const groupBy: typeof groupByPolyfill = (Map as any).groupBy ?? groupByPolyfill;

export class Summary {

	/**
	 * All variables and each of their possible values.
	 */
	readonly vars = new Map<string, Set<string>>();

	/**
	 * Descriptions of metrics.
	 *
	 * @see ProfilingContext.meta
	 */
	readonly meta = new Map<string, MetricMeta>();

	readonly table: FlattedResult[] = [];

	/**
	 * Additional noteworthy information generated during the run of the suite.
	 *
	 * @see ProfilingContext.warn
	 * @see ProfilingContext.note
	 */
	readonly notes: ResolvedNote[] = [];

	readonly hashTable = new Map<string, FlattedResult>();

	baseline?: BaselineOptions;

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
		this.baseline = toolchain.baseline;

		if (builder) {
			this.addToVar("Builder", builder);
		}
		if (executor) {
			this.addToVar("Executor", executor);
		}
		for (const [key, values] of paramDef) {
			this.addToVar(key, ...values);
		}

		for (const [k, v] of Object.entries(toolchain.meta)) {
			this.meta.set(k, v);
		}

		for (const scene of scenes) {
			const params = iter.next().value;
			for (const [name, metrics] of Object.entries(scene)) {
				const flatted = {
					...params,
					Builder: builder,
					Executor: executor,
					Name: name,
					[kMetrics]: metrics,
				};
				this.table.push(flatted);
				this.hashTable.set(JSON.stringify(flatted), flatted);
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

	createVariableArray() {
		return Array.from(this.vars.values(), firstItem) as string[];
	}

	/**
	 * Grouping results by all variables except the ignore parameter.
	 */
	group(ignore: string) {
		const keys = Array.from(this.vars.keys()).filter(k => k !== ignore);
		return groupBy(this.table, row => shallowHashKey(row, keys));
	}

	find(properties: FlattedResult) {
		return this.hashTable.get(JSON.stringify(properties));
	}

	findAll(values: string[], axis: string) {
		const keys = [...this.vars.keys()];
		return this.table.filter(row =>
			keys.every((k, i) => k === axis ? true : row[k] === values[i]));
	}
}
