import { ellipsis, MultiMap } from "@kaciras/utilities/browser";
import { HookFn } from "./suite.js";

export const RE_ANY = new RegExp("");

export const BUILTIN_VARS = ["Name", "Builder", "Executor"];

const NAME_LENGTH = 16;

/**
 * Convert the value to short (length <= 16) string.
 */
export function toDisplayName(v: unknown) {
	if (Array.isArray(v)) {
		return ellipsis(`[${v}]`, NAME_LENGTH - 2);
	}
	if (v === null) {
		return "null";
	}
	switch (typeof v) {
		case "object":
			return typeof v.toString === "function"
				? ellipsis(v.toString(), NAME_LENGTH)
				: "[object null]";
		case "symbol":
			return v.description
				? `Symbol(${ellipsis(v.description, NAME_LENGTH - 8)})`
				: "Symbol()";
		case "function":
			return v.name
				? `${ellipsis(v.name, NAME_LENGTH)}`
				: "Anonymous fn";
		default:
			return ellipsis("" + v, NAME_LENGTH);
	}
}

export function runFns(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

export function attrx(input: Array<string | false>) {
	const string = input.filter(Boolean).join(", ");
	return string.length === 0 ? "" : ` [${string}]`;
}

/*
 * Does not use `JSON.stringify` because it cannot add
 * spaces after bracket and colon (not pretty enough).
 *
 * No escaping, but variables that could be confused are
 * user-defined, so it's not a problem.
 */
export function variablesToString(vars: Iterable<[string, Iterable<string>]>) {
	let result = "";
	for (const [n, l] of vars) {
		result += `- ${n}: [`;
		for (const v of l) {
			result += v;
			result += ", ";
		}
		result = result.slice(0, -2) + "]\n";
	}
	return result.slice(0, -1);
}

export class SharedModeFilter {

	readonly index: number;
	readonly count: number;

	private state: number;

	constructor(index: number, count: number) {
		this.count = count;
		this.index = index;
		this.state = index;

		if (index < 0) {
			throw new Error("Shared index must be a positive number");
		}
		if (index >= count) {
			throw new Error("Shared count can't be less than the index");
		}
	}

	static parse(option = "1/1") {
		const match = /^(\d+)\/(\d+)$/.exec(option);
		if (!match) {
			throw new Error(`Invalid --shared parameter: ${option}`);
		}
		const [, index, count] = match;
		return new SharedModeFilter(parseInt(index) - 1, parseInt(count));
	}

	select<T>(array: T[]) {
		const { state, count } = this;
		if (count === 1) {
			return array;
		}
		const l = array.length;
		const filtered = [];
		let k = state;
		for (; k < l; k += count) {
			filtered.push(array[k]);
		}
		this.state = (k - l) % count;
		return filtered;
	}

	roll() {
		return (this.state = (this.state + 1) % this.count) === 0;
	}
}

export function indexOf<T>(iter: Iterable<T>, v: T) {
	let i = 0;
	for (const x of iter) {
		if (x === v)
			return i;
		i += 1;
	}
	return -1;
}

export function groupByPolyfill<K, T>(items: Iterable<T>, keySelector: (e: T) => K) {
	const grouped = new MultiMap<K, T>();
	for (const item of items) {
		grouped.add(keySelector(item), item);
	}
	return grouped as Map<K, T[]>;
}

// https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map/groupBy
export const groupBy: typeof groupByPolyfill = Map.groupBy ?? groupByPolyfill;

type CPMapSrc = ReadonlyArray<readonly [string, readonly unknown[] | Set<unknown>]>;

function len(list: CPMapSrc[number][1]) {
	return (list as Set<unknown>).size ?? (list as unknown[]).length;
}

export class CartesianProductMap<T> {

	private readonly source: CPMapSrc;
	private readonly values: T[];
	private readonly weights: number[];

	constructor(source: CPMapSrc, values: T[]) {
		this.source = source;
		this.values = values;

		this.weights = new Array(source.length + 1);
		this.weights[source.length] = 1;
		let weight = 1;
		for (let i = source.length - 1; i >= 0; i--) {
			this.weights[i] = weight;
			weight *= len(source[i][1]);
		}

		if (values.length !== weight) {
			throw new Error(`Values should have length = ${weight}, but got ${values.length}`);
		}
	}

	getValue(properties: Record<string, any>) {
		const { source, weights } = this;
		let cpIndex = 0;

		for (let i = 0; i < source.length; i++) {
			const [k, values] = source[i];
			const v = properties[k];

			const varIndex = indexOf(values, v);
			if (varIndex === -1) {
				return NaN;
			}
			cpIndex += weights[i] * varIndex;
		}
		return this.values[cpIndex];
	}

	getSrcIndex(key: number, valueIndex: number) {
		const length = len(this.source[key][1]);
		const weight = this.weights[key];
		return Math.floor(valueIndex / weight) % length;
	}

	group(keys: number[]) {
		const { source, weights, values } = this;
		const groups: T[][] = [];
		let items: T[];
		const innerKeys: number[] = [];

		for (let i = 0; i < source.length; i++) {
			if (!keys.includes(i)) {
				innerKeys.push(i);
			}
		}

		recursiveOuter(0, 0);
		return groups;

		function recursiveOuter(i: number, w: number) {
			if (i === keys.length) {
				groups.push(items = []);
				return recursiveInner(0, w);
			}
			const k = keys[i];
			for (let j = 0; j < len(source[k][1]); j++) {
				recursiveOuter(i + 1, w + weights[k] * j);
			}
		}

		function recursiveInner(i: number, w: number) {
			if (i === innerKeys.length) {
				return items.push(values[w]);
			}
			const k = innerKeys[i];
			for (let j = 0; j < len(source[k]); j++) {
				recursiveInner(i + 1, w + weights[k] * j);
			}
		}
	}
}
