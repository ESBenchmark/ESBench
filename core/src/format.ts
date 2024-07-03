import type { ForegroundColorName } from "chalk";
import {
	dataSizeIEC,
	decimalPrefix,
	durationFmt,
	identity,
	separateThousand,
	UnitConvertor,
} from "@kaciras/utilities/browser";
import { markdownTable } from "markdown-table";
import { SummaryTable } from "./table.js";

export interface FormatOptions {
	/**
	 * How to apply style to cell, it is also the place for escaping.
	 *
	 * Values have associated colors in the table will be converted using
	 * `stainer[color](value)`, others using `stainer(value)`.
	 *
	 * By default, it will just return the value as is.
	 */
	stainer?: Stainer;

	/**
	 * Allow values of columns in the same group to have different units.
	 *
	 * @default false
	 * @example
	 *    (flexUnit = true)       (flexUnit = false)
	 * |   name |      time |   |   name |       time |
	 * | -----: | --------: |   | -----: | ---------: |
	 * | object | 938.45 ms |   | object |  938.45 ms |
	 * |    map |    1.03 s |   |    map | 1031.22 ms |
	 */
	flexUnit?: boolean;
}

export interface FormattedTable extends Array<string[]> {
	/**
	 * Render this table to the source code of a Markdown table.
	 *
	 * @param stringLength Function to detect the length of cell content.
	 */
	toMarkdown(stringLength?: (s: string) => number): string;
}

export type ANSIColor = Exclude<ForegroundColorName, "gray" | "grey">

type Stainer = Record<ANSIColor, (str: string) => string> & {
	(str: string): string;
};

const noColor = new Proxy(identity as Stainer, { get: identity });

const formatRE = /^\{(\w+)(?:\.(\w+))?}/;

type FormatFn = (value: any) => string;

const formatters: Record<string, UnitConvertor> = {
	number: decimalPrefix,
	duration: durationFmt,
	dataSize: dataSizeIEC,
};

export function parseFormat(template: string) {
	const match = formatRE.exec(template);
	if (match) {
		const [p, type, rawUnit] = match;
		return {
			formatter: formatters[type],
			rawUnit,
			suffix: template.slice(p.length),
		};
	}
	throw new Error("Invalid metric format: " + template);
}

function formatColumn(table: SummaryTable["cells"], column: number, template: string, flex: boolean) {
	const numbers: number[] = [];
	for (const row of table) {
		const value = row[column];
		if (typeof value === "string") {
			throw new TypeError(`Cannot apply number format to "${value}"`);
		}
		if (typeof value === "number") {
			numbers.push(value);
		}
	}

	const { formatter, rawUnit, suffix } = parseFormat(template);
	let format: FormatFn;
	if (flex) {
		format = (value: number) => separateThousand(formatter.formatDiv(value, rawUnit));
	} else {
		const fixed = formatter.homogeneous(numbers, rawUnit);
		format = (value: number) => separateThousand(fixed.format(value));
	}

	for (const row of table) {
		const value = row[column];
		row[column] = value === undefined ? "" : format(value) + suffix;
	}
}

function toMarkdown(this: string[][], stringLength: any) {
	return markdownTable(this, { stringLength, align: "r" });
}

export default function format(input: SummaryTable, options: FormatOptions = {}) {
	const { formats, cells, colors, groupEnds } = input;
	const { flexUnit = false, stainer = noColor } = options;
	const table = [[]] as unknown as FormattedTable;

	function applyStyle(value: any, r: number, c: number) {
		const x = colors[r][c];
		return x ? stainer[x](value) : stainer(value);
	}

	for (let i = 0; i < formats.length; i++) {
		const v = cells[0][i];
		table[0].push(applyStyle(v, 0, i));
	}

	const separator = new Array(formats.length);
	let offset = 1;
	for (const e of groupEnds) {
		const copy = cells.slice(offset, e).map(r => r.slice());

		for (let i = 0; i < formats.length; i++) {
			if (formats[i]) {
				formatColumn(copy, i, formats[i]!, flexUnit);
			}
			for (let j = 0; j < copy.length; j++) {
				const v = copy[j][i];
				copy[j][i] = applyStyle(v, offset + j, i);
			}
		}

		offset = e;
		table.push(...copy as string[][], separator);
	}
	table.pop();
	table.toMarkdown = toMarkdown;
	return table;
}
