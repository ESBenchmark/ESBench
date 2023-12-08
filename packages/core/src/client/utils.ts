import { CPSrcObject, durationFmt, ellipsis } from "@kaciras/utilities/browser";
import { HookFn } from "./suite.js";
import { LogHandler } from "./runner.js";

export const consoleLogHandler: LogHandler = (level, message = "") => console[level](message);

interface ProcessedParamDef {
	length: number;
	paramDef: Record<string, string[]>;
}

/**
 * Convert the value to a short display string.
 */
function displayName(v: unknown) {
	if (Array.isArray(v)) {
		return ellipsis(`[${v}]`, 16);
	}
	if (v === null) {
		return "null";
	}
	switch (typeof v) {
		case "object":
			return typeof v.toString === "function"
				? ellipsis(v.toString(), 16)
				: "[object null]";
		case "symbol":
			return v.description
				? `symbol(${ellipsis(v.description, 10)})`
				: "symbol";
		case "function":
			return v.name
				? `${ellipsis(v.name, 11)}(...)`
				: "Anonymous fn";
		default:
			return ellipsis("" + v, 16);
	}
}

export function process(params: CPSrcObject) {
	const entries = Object.entries(params);
	const paramDef: Record<string, string[]> = {};
	const set = new Set<string>();

	let length = 1;
	for (const [key, values] of entries) {
		const current: string[] = [];
		paramDef[key] = current;

		for (const v of values) {
			const name = displayName(v);
			set.add(name);
			current.push(name);
		}

		if (set.size !== current.length) {
			throw new Error("Parameter display name conflict.");
		}

		set.clear();
		length *= current.length;
	}

	return { length, paramDef } as ProcessedParamDef;
}

export function runHooks(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

export function timeDetail(time: number, count: number) {
	const total = durationFmt.formatDiv(time, "ms");
	const mean = durationFmt.formatDiv(time / count, "ms");
	return `${count} operations, ${total}, ${mean}/op`;
}
