import type { ForegroundColorName } from "chalk";
import {
	dataSizeIEC,
	decimalPrefix,
	durationFmt,
	HomogeneousUC,
	identity,
	separateThousand,
	UnitConvertor,
} from "@kaciras/utilities/browser";
import { markdownTable } from "markdown-table";
import { CellValue, SummaryTable } from "./table.js";

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

export type ANSIColor = Exclude<ForegroundColorName, "gray" | "grey">;

type Stainer = Record<ANSIColor, (str: string) => string> & {
	(str: string): string;
};

const noColor = new Proxy(identity as Stainer, { get: identity });

const formatRE = /^\{(\w+)(?:\.(\w+))?}/;

const unitConvertors: Record<string, UnitConvertor> = {
	number: decimalPrefix,
	duration: durationFmt,
	dataSize: dataSizeIEC,
};

export interface MetricFormatter {
	unit?: string;

	fixed?(values: CellValue[]): FixedFormatter;

	format(value: CellValue): string;
}

export interface FixedFormatter {
	unit: string;
	scale: number;

	format(value: CellValue): string;
}

class CommonUnitFormatter implements MetricFormatter {

	readonly convertor: UnitConvertor;
	readonly unit: string;
	readonly suffix: string;

	constructor(unit: string, suffix: string, convertor: UnitConvertor) {
		if (unit === undefined) {
			this.unit = convertor.units[0];
		} else {
			this.unit = unit;
		}
		this.suffix = suffix;
		this.convertor = convertor;
	}

	fixed(values: CellValue[]) {
		const { convertor, unit, suffix } = this;
		const numbers: number[] = [];

		for (const value of values) {
			switch (typeof value) {
				case "string":
					throw new TypeError(`Cannot apply number format to "${value}"`);
				case "number":
					numbers.push(value);
			}
		}
		const fixed = convertor.homogeneous(numbers, unit);
		return new CommonUnitFixed(fixed, suffix);
	}

	format(value: CellValue) {
		const { convertor, unit, suffix } = this;
		switch (typeof value) {
			case "string":
				throw new TypeError(`Cannot apply number format to "${value}"`);
			case "undefined":
				return "";
		}
		const string = convertor.formatDiv(value, unit);
		return separateThousand(string) + suffix;
	}
}

class CommonUnitFixed implements FixedFormatter {

	readonly convertor: HomogeneousUC;
	readonly suffix: string;

	constructor(convertor: HomogeneousUC, suffix: string) {
		this.convertor = convertor;
		this.suffix = suffix;
	}

	get scale() {
		return this.convertor.scale;
	}

	get unit() {
		return this.convertor.unit + this.suffix;
	}

	format(value: CellValue) {
		switch (typeof value) {
			case "string":
				throw new TypeError(`Cannot apply number format to "${value}"`);
			case "undefined":
				return "";
		}
		const string = this.convertor.format(value as number);
		return separateThousand(string) + this.suffix;
	}
}

const stringFormatter: FixedFormatter & MetricFormatter = {
	scale: 1,
	unit: "",
	fixed: () => stringFormatter,
	format: value => value ? value.toString() : "",
};

export function createFormatter(template?: string): MetricFormatter {
	if (!template) {
		return stringFormatter;
	}
	const match = formatRE.exec(template);
	if (!match) {
		throw new Error(`Invalid metric format: ${template}`);
	}

	const [{ length }, type, rawUnit] = match;
	const convertor = unitConvertors[type];
	if (!convertor) {
		throw new Error(`Metric type: "${type}" does not have convertor`);
	}

	const suffix = template.slice(length);
	return new CommonUnitFormatter(rawUnit, suffix, convertor);
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

	// Apply colors to the header.
	for (let i = 0; i < formats.length; i++) {
		const v = cells[0][i];
		table[0].push(applyStyle(v, 0, i));
	}

	// The empty row should have same length with the table.
	const separator = new Array(formats.length);

	let offset = 1;
	for (const e of groupEnds) {
		const copy = cells.slice(offset, e).map(r => r.slice());

		for (let i = 0; i < formats.length; i++) {
			let formatter = createFormatter(formats[i]);
			if (!flexUnit && formatter.fixed) {
				formatter = formatter.fixed(copy.map(r => r[i]));
			}
			for (let j = 0; j < copy.length; j++) {
				const v = formatter.format(copy[j][i]);
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
