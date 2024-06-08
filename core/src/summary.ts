import { cartesianObject, firstItem, MultiMap } from "@kaciras/utilities/browser";
import { ResultBaseline } from "./runner.js";
import { MetricMeta, Metrics } from "./profiling.js";
import { ToolchainResult } from "./connect.js";

const kMetrics = Symbol("metrics");
const kIndex = Symbol("index");

export type FlattedResult = Record<string, string> & {

	// Retrieved by `Summary.getMetrics()`.
	[kMetrics]: Metrics;

	// Internal use, updated on `Summary.sort`.
	// The index in cartesian product of all variables.
	[kIndex]: number;

	// You can add custom properties with symbol keys.
	[customKeys: symbol]: any;
}

export interface ResolvedNote {
	type: "info" | "warn";
	text: string;
	case?: FlattedResult;
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

function indexOf<T>(iter: Iterable<T>, v: T) {
	let i = 0;
	for (const x of iter) {
		if (x === v)
			return i;
		i += 1;
	}
	return -1;
}

export class Summary {
	/**
	 * All variable names and each of their possible values.
	 */
	readonly vars = new Map<string, Set<string>>();

	/**
	 * Descriptions of metrics.
	 *
	 * @see ProfilingContext.meta
	 */
	readonly meta = new Map<string, MetricMeta>();

	/**
	 * Array of the variables of benchmark cases.
	 */
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
	readonly baseline?: ResultBaseline;

	private table!: Array<FlattedResult | undefined>;
	private keys!: string[];
	private weights: number[] = [];

	/**
	 * Parsing the results of the benchmark suite runs to create Summary.
	 *
	 * The parameter is usually the results of a suite under its toolchains,
	 * but there is also support for passing results of different suites to merge them,
	 * in this case you need to avoid conflicts in analyzers and baselines.
	 */
	constructor(suiteResults: ToolchainResult[]) {
		// Ensure the Name is the first entry.
		this.vars.set("Name", new Set());

		for (const result of suiteResults) {
			this.addResult(result);
			this.baseline = result.baseline;
		}

		const [name, ...rest] = Array.from(this.vars.keys());
		this.sort([...rest, name]);
	}

	private addResult(toolchain: ToolchainResult) {
		const { executor, builder, paramDef, scenes, notes } = toolchain;
		const offset = this.results.length;
		const iter = cartesianObject(paramDef)[Symbol.iterator]();

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
				resolved.case = this.results[offset + caseId];
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

	/**
	 * Sort results by variables, use multiple keys sort algorithm.
	 * The more precedent key in `keys` have higher weight,
	 * for each key, the priority is index of the value in `this.vars.get(key)`.
	 *
	 * @param keys Sort keys, must be all of `this.vars.keys()`.
	 */
	sort(keys: string[]) {
		const { results, vars, weights } = this;

		if (new Set(keys).size !== vars.size) {
			throw new Error("Keys must be all variable names");
		}

		weights.length = keys.length;
		let weight = 1;
		for (let i = keys.length - 1; i >= 0; i--) {
			const k = keys[i];
			const values = vars.get(k);
			if (!values) {
				throw new Error(`${k} is not in variables`);
			}
			weights[i] = weight;
			weight *= values.size;
		}

		this.table = new Array(weight);
		this.keys = keys;
		for (const item of results) {
			const index = this.getIndex(item);
			item[kIndex] = index;
			this.table[index] = item;
		}

		let index = 0;
		for (const maybeItem of this.table) {
			if (maybeItem)
				results[index++] = maybeItem;
		}
	}

	private getIndex(props: Record<string, string>) {
		const { keys, weights, vars } = this;
		let cpIndex = 0;

		for (let i = 0; i < keys.length; i++) {
			const k = keys[i];
			const v = props[k];

			// Already checked in `sort`.
			const s = vars.get(k)!;
			const varIndex = indexOf(s, v);
			if (varIndex === -1) {
				return NaN;
			}
			cpIndex += weights[i] * varIndex;
		}
		return cpIndex;
	}

	private getWeight(key: string) {
		const i = this.keys.indexOf(key);
		if (i !== -1) {
			return this.weights[i];
		}
		throw new Error(`${key} is not in variables`);
	}

	/**
	 * Grouping results by all variables except the key parameter.
	 */
	split(key: string) {
		const values = this.vars.get(key)!;
		const w = this.getWeight(key);
		return groupBy(this.results, item => item[kIndex] - w * indexOf(values, item[key]));
	}

	/**
	 * Find the result that contains exactly the variables, non-variable properties are ignored.
	 *
	 * @return Corresponding result, or `undefined` if it does not exist.
	 */
	find(variables: Record<string, string>) {
		return this.table[this.getIndex(variables)];
	}

	findAll(constants: Record<string, string>, variable: string) {
		const values = this.vars.get(variable);
		if (!values) {
			throw new Error(`${variable} is not in variables`);
		}
		const w = this.getWeight(variable);

		const copy = { ...constants };
		copy[variable] = firstItem(values)!;
		const base = this.getIndex(copy);

		return Array.from(values, (_, i) => this.table[base + w * i]);
	}
}
