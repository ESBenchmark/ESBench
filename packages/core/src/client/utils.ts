import { CPSrcObject, durationFmt, ellipsis } from "@kaciras/utilities/browser";
import { BenchCase, HookFn, Scene } from "./suite.js";
import { LogHandler, Profiler, ProfilingContext } from "./runner.js";

export const consoleLogHandler: LogHandler = (level, message = "") => console[level](message);

const NAME_LENGTH = 16;

export const BUILTIN_FIELDS = ["Name", "Builder", "Executor"];

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
	const paramDef: Record<string, string[]> = {};
	const set = new Set<string>();

	if (Object.getOwnPropertySymbols(params).length) {
		throw new Error("Property with only string keys are allowed in param");
	}

	for (const [key, values] of entries) {
		if (BUILTIN_FIELDS.includes(key)) {
			throw new Error(`'${key}' is a builtin parameter`);
		}
		const current: string[] = [];
		paramDef[key] = current;
		set.clear();

		for (const v of values) {
			const name = toDisplayName(v);
			if (set.has(name)) {
				throw new Error(`Parameter display name conflict (${key}: ${name})`);
			}
			set.add(name);
			current.push(name);
		}
	}

	return paramDef;
}

export function runFns(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

export function timeDetail(time: number, count: number) {
	const total = durationFmt.formatDiv(time, "ms");
	const mean = durationFmt.formatDiv(time / count, "ms");
	return `${count} operations, ${total}, ${mean}/op`;
}

export function addThousandCommas(text: string) {
	return text.replaceAll(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export class DefaultEventLogger implements Profiler {

	private index = 0;

	onSuite(ctx: ProfilingContext) {
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
