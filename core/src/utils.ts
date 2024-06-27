import { CPSrcObject, ellipsis } from "@kaciras/utilities/browser";
import { HookFn, ParamsDef } from "./suite.js";

export const kWorkingParams = Symbol();

export const RE_ANY = new RegExp("");

export const BUILTIN_VARS = ["Name", "Builder", "Executor"];

const NAME_LENGTH = 16;

/**
 * Convert the value to a short (length <= 16) display string.
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

function *getFromIter(values: Iterable<unknown>) {
	for (const value of values) yield [value, value];
}

function getFromObject(values: Record<string, unknown>) {
	return Object.entries(values);
}

export function checkParams(params: ParamsDef) {
	const names = Object.entries(params);
	const cpSrc: CPSrcObject = {};
	const set = new Set<string>();

	if (Object.getOwnPropertySymbols(params).length) {
		throw new Error("Only string keys are allowed in param");
	}

	for (let i = 0; i < names.length; i++) {
		const [key, values] = names[i];
		if (BUILTIN_VARS.includes(key)) {
			throw new Error(`'${key}' is a builtin variable`);
		}
		const current: string[] = [];
		const valueArr = cpSrc[key] = [] as unknown[];
		set.clear();
		names[i][1] = current;

		const iter = Symbol.iterator in values ? getFromIter(values) : getFromObject(values);

		for (const [name, value] of iter) {
			valueArr.push(value);
			const display = toDisplayName(name);
			if (set.has(display)) {
				throw new Error(`Parameter display name conflict (${key}: ${display})`);
			}
			set.add(display);
			current.push(display);
		}

		if (current.length === 0) {
			throw new Error(`Suite parameter "${key}" must have a value`);
		}
	}

	return [cpSrc, names as Array<[string, string[]]>] as const;
}

export function runFns(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

export class SharedModeFilter {

	readonly index: number;
	readonly count: number;

	private state = 0;

	constructor(index: number, count: number) {
		this.count = count;
		this.index = index;

		if (index >= count) {
			throw new Error("Shared count can't be less than the index");
		}
		if (index < 0) {
			throw new Error("Shared index must be a positive number");
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
		const { state, index, count } = this;
		if (count === 1) {
			return array;
		}
		const s = array.length;
		const filtered = [];
		let i = index + state;
		for (; i < s; i += count) {
			filtered.push(array[i]);
		}
		this.state = (i - s) % count;
		return filtered;
	}
}
