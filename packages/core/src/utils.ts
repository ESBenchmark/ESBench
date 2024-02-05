import { CPSrcObject, ellipsis } from "@kaciras/utilities/browser";
import { BenchCase, HookFn, Scene } from "./suite.js";
import { LogHandler, Profiler, ProfilingContext } from "./runner.js";

export const consoleLogHandler: LogHandler = (level, message = "") => console[level](message);

export const RE_ANY = new RegExp("");

const NAME_LENGTH = 16;

export const BUILTIN_VARS = ["Name", "Builder", "Executor"];

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
				? `symbol(${ellipsis(v.description, NAME_LENGTH - 8)})`
				: "symbol";
		case "function":
			return v.name
				? `${ellipsis(v.name, NAME_LENGTH - 5)}(...)`
				: "Anonymous fn";
		default:
			return ellipsis("" + v, NAME_LENGTH);
	}
}

export function checkParams(params: CPSrcObject) {
	const entries = Object.entries(params);
	const set = new Set<string>();

	if (Object.getOwnPropertySymbols(params).length) {
		throw new Error("Only string keys are allowed in param");
	}

	for (let i = 0; i < entries.length; i++) {
		const [key, values] = entries[i];
		if (BUILTIN_VARS.includes(key)) {
			throw new Error(`'${key}' is a builtin parameter`);
		}
		const current: string[] = [];
		set.clear();
		entries[i][1] = current;

		for (const v of values) {
			const name = toDisplayName(v);
			if (set.has(name)) {
				throw new Error(`Parameter display name conflict (${key}: ${name})`);
			}
			set.add(name);
			current.push(name);
		}

		if (current.length === 0) {
			throw new Error(`Suite parameter "${key}" must have a value`);
		}
	}

	return entries as Array<[string, string[]]>;
}

export function runFns(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

export function insertThousandCommas(text: string) {
	return text.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function resolveRE(pattern?: string | RegExp) {
	if (!pattern) {
		return RE_ANY;
	}
	return pattern instanceof RegExp ? pattern : new RegExp(pattern);
}

export class SharedModeFilter {

	readonly index: number;
	readonly count: number;

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
		const { index, count } = this;
		if (count === 1) {
			return array;
		}
		return array.filter((_, i) => i % count === index);
	}
}

export class DefaultEventLogger implements Profiler {

	private index = 0;

	onStart(ctx: ProfilingContext) {
		return ctx.info(`\nSuite: ${ctx.suite.name}, ${ctx.sceneCount} scenes.`);
	}

	onScene(ctx: ProfilingContext, scene: Scene) {
		const caseCount = scene.cases.length;
		const { sceneCount } = ctx;

		return caseCount === 0
			? ctx.warn(`\nNo case found from scene #${this.index++}.`)
			: ctx.info(`\nScene ${this.index++} of ${sceneCount}, ${caseCount} cases.`);
	}

	onCase(ctx: ProfilingContext, case_: BenchCase) {
		const { name, isAsync, setupHooks, cleanHooks } = case_;
		const hooks = setupHooks.length + cleanHooks.length > 0;
		return ctx.info(`\nCase: ${name} (Async=${isAsync}, InvocationHooks=${hooks})`);
	}
}
