import { cartesianObject, MultiMap } from "@kaciras/utilities/browser";
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
const kIndex = Symbol("index");

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

	baseline?: BaselineOptions;

	private readonly hashTable = new Map<string, FlattedResult>();
	private readonly keys: string[];

	constructor(suiteResult: ToolchainResult[]) {
		// Ensure the Name is the first entry.
		this.vars.set("Name", new Set());

		for (const result of suiteResult) {
			this.addResult(result);
		}
		this.sort(this.keys = Array.from(this.vars.keys()));
	}

	private addResult(toolchain: ToolchainResult) {
		const { executor, builder, paramDef, scenes, notes } = toolchain;
		const offset = this.table.length;
		const iter = cartesianObject(paramDef)[Symbol.iterator]();
		this.baseline = toolchain.baseline;

		if (executor) {
			this.addToVar("Executor", executor);
		}
		if (builder) {
			this.addToVar("Builder", builder);
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
					Name: name,
					Executor: executor,
					Builder: builder,
					...params,
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

	static getMetrics(item: FlattedResult) {
		return item[kMetrics];
	}

	sort(varNames: string[]) {
		const src: Array<[string, Set<string>]> = [];
		for (const key of varNames) {
			const values = this.vars.get(key);
			if (!values) {
				throw new Error(`${key} is not in variables`);
			}
			src.push([key, values]);
		}
		let index = 0;
		for (const properties of cartesianObject(src)) {
			const item = this.find(properties);
			if (item) {
				item[kIndex] = index++;
			}
		}
		this.table.sort((a, b) => a[kIndex] - b[kIndex]);
	}

	/**
	 * Grouping results by all variables except the ignore parameter.
	 */
	group(ignore: string) {
		const keys = this.keys.filter(k => k !== ignore);
		return groupBy(this.table, item => JSON.stringify(item, keys));
	}

	/**
	 * Find the result that contains exactly the variables,
	 * Non-variable properties will be ignored.
	 */
	find(variables: Record<string, string>) {
		return this.hashTable.get(JSON.stringify(variables, this.keys));
	}

	findAll(variables: Record<string, string>, axis: string) {
		const copy = { ...variables };
		return [...this.vars.get(axis)!].map(v => {
			copy[axis] = v;
			return this.hashTable.get(JSON.stringify(copy, this.keys));
		});
	}
}
