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

function groupByPolyfill<T>(items: Iterable<T>, callbackFn: (e: T) => any) {
	const group = new MultiMap<string, T>();
	for (const element of items) {
		group.add(callbackFn(element), element);
	}
	return group;
}

// https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy
const groupBy: typeof groupByPolyfill = (Map as any).groupBy ?? groupByPolyfill;

function indexOf<T>(iter: Iterable<T>, k: string, v: T) {
	let index = 0;
	for (const x of iter) {
		if (x === v)
			return index;
		index += 1;
	}
	throw new Error(`${k}=${v} is not in variables`);
}

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

	readonly results: FlattedResult[] = [];

	/**
	 * Additional noteworthy information generated during the run of the suite.
	 *
	 * @see ProfilingContext.warn
	 * @see ProfilingContext.note
	 */
	readonly notes: ResolvedNote[] = [];

	/**
	 * The suite's baseline option.
	 */
	baseline?: BaselineOptions;

	private table!: FlattedResult[];
	private keys!: string[];
	private factors!: number[];

	constructor(suiteResult: ToolchainResult[]) {
		// Ensure the Name is the first entry.
		this.vars.set("Name", new Set());

		for (const result of suiteResult) {
			this.addResult(result);
		}

		const [name, ...rest] = Array.from(this.vars.keys());
		this.sort([...rest, name]);
	}

	private addResult(toolchain: ToolchainResult) {
		const { executor, builder, paramDef, scenes, notes } = toolchain;
		const offset = this.results.length;
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
				this.results.push(flatted);
				this.addToVar("Name", name);
			}
		}

		for (const { type, text, caseId } of notes) {
			const resolved: ResolvedNote = { type, text };
			this.notes.push(resolved);
			if (caseId !== undefined) {
				resolved.row = this.results[offset + caseId];
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

	sort(keys: string[]) {
		if (new Set(keys).size !== this.vars.size) {
			throw new Error("Keys must be all variable names");
		}
		const factors = this.factors = new Array(keys.length);
		this.keys = keys;

		let factor = 1;
		for (let i = keys.length - 1; i >= 0; i--) {
			const k = keys[i];
			const values = this.vars.get(k);
			if (!values) {
				throw new Error(`${k} is not in variables`);
			}
			factors[i] = factor;
			factor *= values.size;
		}

		this.table = new Array(factor);
		for (const item of this.results) {
			const index = this.getIndex(item);
			item[kIndex] = index;
			this.table[index] = item;
		}
		this.results.sort((a, b) => a[kIndex] - b[kIndex]);
	}

	private getIndex(props: Record<string, string>) {
		const { keys, factors, vars } = this;
		let index = 0;
		for (let i = 0; i < keys.length; i++) {
			const k = keys[i];
			const v = props[k];
			const s = vars.get(k);
			if (!s) {
				throw new Error(`${k} is not in variables`);
			}
			index += factors[i] * indexOf(s, k, v);
		}
		return index;
	}

	private getFactor(key: string) {
		const i = this.keys.indexOf(key);
		if (i !== -1) {
			return this.factors[i];
		}
		throw new Error(`${key} is not in variables`);
	}

	/**
	 * Grouping results by all variables except the ignore parameter.
	 */
	group(ignore: string) {
		const values = this.vars.get(ignore)!;
		const f = this.getFactor(ignore);
		return groupBy(this.results, item =>
			item[kIndex] - f * indexOf(values, ignore, item[ignore]));
	}

	/**
	 * Find the result that contains exactly the variables,
	 * Non-variable properties will be ignored.
	 */
	find(variables: Record<string, string>) {
		return this.table[this.getIndex(variables)];
	}

	findAll(variables: Record<string, string>, axis: string) {
		const values = this.vars.get(axis)!;
		const f = this.getFactor(axis);

		const copy = { ...variables };
		copy[axis] = firstItem(values)!;
		const base = this.getIndex(copy);

		return Array.from(values, (_, i) => this.table[base + f * i]);
	}
}
