import { CPSrcObject, durationFmt, ellipsis } from "@kaciras/utilities/browser";
import { mean, sampleVariance } from "simple-statistics";
import { HookFn } from "./suite.js";
import { LogHandler } from "./runner.js";

export const consoleLogHandler: LogHandler = (level, message = "") => console[level](message);

const NAME_LENGTH = 16;

/**
 * Convert the value to a short (length <= 16) display string.
 */
function toDisplayName(v: unknown) {
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

interface ProcessedParamDef {
	length: number;
	paramDef: Record<string, string[]>;
}

export function checkParams(params: CPSrcObject) {
	const entries = Object.entries(params);
	const paramDef: Record<string, string[]> = {};
	const set = new Set<string>();

	let length = 1;
	for (const [key, values] of entries) {
		const current: string[] = [];
		paramDef[key] = current;

		for (const v of values) {
			const name = toDisplayName(v);
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

export function welchTTestGreater(left: number[], right: number[]) {
	if (left.length < 2 || right.length < 2) {
		return NaN;
	}

	const leftSE = sampleVariance(left) / left.length;
	const rightSE = sampleVariance(right) / right.length;
	const se = leftSE + rightSE;

	const t = (mean(left) - mean(right)) / Math.sqrt(se);
	const df = Math.pow(se, 2) / (
		Math.pow(leftSE, 2) / (left.length - 1) +
		Math.pow(rightSE, 2) / (right.length - 1)
	);

	return studentOneTail(t, df);
}

function studentOneTail(t: number, df: number): number {
	if (t < 0) {
		return 1.0 - studentTwoTail(t, df) / 2.0;
	}
	return 1.0 - studentOneTail(0.0 - t, df);
}

function studentTwoTail(t: number, df: number) {
	const g = Math.exp(logGamma(df / 2.0) + logGamma(0.5) - logGamma(df / 2.0 + 0.5));
	const b = df / (t * t + df);

	function f(r: number) {
		return Math.pow(r, df / 2.0 - 1.0) / Math.sqrt(1.0 - r);
	}

	// n = 10000 seems more than enough here.
	return simpson(0.0, b, 10000, f) / g;
}

function simpson(a: number, b: number, n: number, f: (r: number) => number) {
	const h = (b - a) / n;
	let sum = 0.0;
	for (let i = 0; i < n; i++) {
		const x = a + i * h;
		sum += (f(x) + 4.0 * f(x + h / 2.0) + f(x + h)) / 6.0;
	}
	return sum * h;
}

function logGamma(z: number) {
	const S = 1 + 76.18009173 / z
		- 86.50532033 / (z + 1)
		+ 24.01409822 / (z + 2)
		- 1.231739516 / (z + 3)
		+ 0.00120858003 / (z + 4)
		- 0.00000536382 / (z + 5);
	return (z - 0.5) * Math.log(z + 4.5)
		- (z + 4.5) + Math.log(S * 2.50662827465);
}
