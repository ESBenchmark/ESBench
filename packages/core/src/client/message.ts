import { CPSrcObject, durationFmt, ellipsis } from "@kaciras/utilities/browser";

function toDisplay(v: unknown, i: number) {
	switch (typeof v) {
		case "object":
			return v === null ? "null" : `object #${i}`;
		case "symbol":
			return v.description
				? `symbol(${ellipsis(v.description, 10)}) #${i}`
				: `symbol #${i}`;
		case "function":
			return `func ${ellipsis(v.name, 10)} #${i}`;
		default:
			return ellipsis("" + v, 16) + ` #${i}`;
	}
}

export function serializable(params: CPSrcObject) {
	const entries = Object.entries(params);
	const paramDef: Record<string, string[]> = {};
	let length = 0;
	let current: string[];

	for (let i = 0; i < entries.length; i++) {
		const [key, values] = entries[i];
		paramDef[key] = current = [];

		for (const v of values) {
			const k = current.length;
			current.push(toDisplay(v, k));
		}

		length += current.length;
	}

	return { length, paramDef };
}

export function timeDetail(time: number, count: number) {
	const total = durationFmt.formatDiv(time, "ms");
	const mean = durationFmt.formatDiv(time / count, "ms");
	return `${count} operations, ${total}, ${mean}/op`;
}
