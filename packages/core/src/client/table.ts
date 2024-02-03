import type { ForegroundColorName } from "chalk";
import { mean, quantileSorted, standardDeviation } from "simple-statistics";
import { dataSizeIEC, decimalPrefix, durationFmt, identity, UnitConvertor } from "@kaciras/utilities/browser";
import { OutlierMode, TukeyOutlierDetector } from "./math.js";
import { Metrics, MetricsMeta } from "./runner.js";
import { BaselineOptions } from "./suite.js";
import { BUILTIN_FIELDS, insertThousandCommas } from "./utils.js";
import { FlattedResult, Summary, ToolchainResult } from "./summary.js";

const { getMetrics } = Summary;

export interface SummaryTableOptions {
	/**
	 * Allow values in the column have different unit.
	 *
	 * @default false
	 * @example
	 *    (flexUnit = false)       (flexUnit = true)
	 * |   name |      time |   |   name |       time |
	 * | -----: | --------: |   | -----: | ---------: |
	 * | object | 938.45 ms |   | object |  938.45 ms |
	 * |    map |    1.03 s |   |    map | 1031.22 ms |
	 */
	flexUnit?: boolean;

	/**
	 * Show standard deviation (*.SD) columns in the report.
	 *
	 * @example
	 * textReporter({ stdDev: true })
	 * | No. |         Name |          time |      time.SD |
	 * | --: | -----------: | ------------: | -----------: |
	 * |   0 |    For-index |       0.37 ns |      0.01 ns |
	 * |   1 |       For-of |       6.26 ns |      2.88 ns |
	 */
	stdDev?: boolean;

	/**
	 * If true, variables with only one value are not shown.
	 *
	 * @default true
	 */
	hideSingle?: boolean;

	/**
	 * Show percentiles columns in the report.
	 *
	 * To make this value more accurate, you can increase `samples` and decrease `iterations` in suite config.
	 *
	 * @example
	 * textReporter({ percentiles: [75, 99] })
	 * |   name |    size |      time |  time.p75 | time.p99 |
	 * | -----: | ------: | --------: | --------: | -------: |
	 * | object |    1000 | 938.45 ms | 992.03 ms |   1.08 s |
	 * |    map |    1000 |    1.03 s |    1.07 s |    1.1 s |
	 */
	percentiles?: number[];

	/**
	 * Specifies which outliers should be removed from the distribution.
	 *
	 * @default "upper"
	 */
	outliers?: false | OutlierMode;
}

type ANSIColor = Exclude<ForegroundColorName, "gray" | "grey">
type ChalkLike = Record<ANSIColor, (str: string) => string>;

const noColors = new Proxy<ChalkLike>(identity as any, { get: identity });

interface ColumnFactory {

	name: string;

	format?: string;

	prepare?(cases: FlattedResult[]): void;

	getValue(data: FlattedResult, chalk: ChalkLike): any;
}

class BaselineColumn implements ColumnFactory {

	private readonly key: string;
	private readonly meta: MetricsMeta;
	private readonly variable: string;
	private readonly value: string;

	private ratio1 = 0;

	constructor(key: string, meta: MetricsMeta, baseline: BaselineOptions) {
		this.key = key;
		this.meta = meta;
		this.variable = baseline.type;
		this.value = baseline.value;
	}

	get name() {
		return this.key + ".Ratio";
	}

	private toNumber(data: FlattedResult) {
		const metrics = getMetrics(data)[this.key];
		return Array.isArray(metrics) ? mean(metrics) : metrics as number;
	}

	prepare(cases: FlattedResult[]) {
		const { variable, value } = this;
		const ratio1Row = cases.find(d => d[variable] === value);
		if (!ratio1Row) {
			throw new Error(`Baseline (${variable}=${value}) does not in the table`);
		}
		this.ratio1 = this.toNumber(ratio1Row);
	}

	getValue(data: FlattedResult, chalk: ChalkLike) {
		const { ratio1, meta: { lowerBetter } } = this;

		const ratio = this.toNumber(data) / ratio1;
		if (!isFinite(ratio)) {
			return chalk.blackBright("N/A");
		}
		const text = `${ratio.toFixed(2)}x`;
		if (ratio === 1) {
			return text;
		}
		return ratio < 1 === lowerBetter ? chalk.green(text) : chalk.red(text);
	}
}

class StdDevColumn implements ColumnFactory {

	readonly key: string;
	readonly format?: string;

	constructor(key: string, meta: MetricsMeta) {
		this.key = key;
		this.format = meta.format;
	}

	get name() {
		return this.key + ".SD";
	}

	getValue(data: FlattedResult) {
		return standardDeviation(getMetrics(data)[this.key] as number[]);
	}
}

class PercentileColumn implements ColumnFactory {

	readonly p: number;
	readonly key: string;
	readonly format?: string;

	constructor(key: string, meta: MetricsMeta, p: number) {
		this.p = p;
		this.key = key;
		this.format = meta.format;
	}

	get name() {
		return `${this.key}.p${this.p}`;
	}

	getValue(data: FlattedResult) {
		return quantileSorted(getMetrics(data)[this.key] as number[], this.p / 100);
	}
}

class RowNumberColumn implements ColumnFactory {

	readonly name = "No.";

	private index = 0;

	getValue(data: FlattedResult) {
		data[kRowNumber] = this.index;
		return (this.index++).toString();
	}
}

class VariableColumn implements ColumnFactory {

	readonly name: string;

	private readonly key: string;

	constructor(key: string, chalk: ChalkLike) {
		this.name = this.key = key;
		if (!BUILTIN_FIELDS.includes(this.key)) {
			this.name = chalk.magentaBright(this.name);
		}
	}

	getValue(data: FlattedResult) {
		return data[this.key];
	}
}

class RawMetricColumn implements ColumnFactory {

	readonly name: string;
	readonly meta: MetricsMeta;

	constructor(name: string, meta: MetricsMeta) {
		this.name = name;
		this.meta = meta;
	}

	get format() {
		return this.meta.format;
	}

	getValue(data: FlattedResult) {
		const metrics = getMetrics(data)[this.name];
		return Array.isArray(metrics) ? mean(metrics) : metrics;
	}
}

class DifferenceColumn implements ColumnFactory {

	private readonly another: Summary;
	private readonly key: string;
	private readonly meta: MetricsMeta;

	constructor(another: Summary, key: string, meta: MetricsMeta) {
		this.another = another;
		this.key = key;
		this.meta = meta;
	}

	get name() {
		return `${this.key}.diff`;
	}

	private toNumber(data: Metrics): number | undefined {
		const metrics = data[this.key];
		return Array.isArray(metrics) ? mean(metrics) : metrics as number;
	}

	getValue(data: FlattedResult, chalk: ChalkLike) {
		const previous = this.another.find(data);
		if (!previous) {
			return "";
		}
		const p = this.toNumber(getMetrics(previous));
		const c = this.toNumber(getMetrics(data));

		if (p === undefined || c === undefined) {
			return "";
		}
		const d = (c - p) / p * 100;
		if (Number.isNaN(d)) {
			return "";
		}
		const text = d > 0 ? `+${d.toFixed(2)}%` : `${d.toFixed(2)}%`;
		return d === 0
			? text : this.meta.lowerBetter === d < 0
				? chalk.green(text) : chalk.red(text);
	}
}

interface TableWithNotes extends Array<string[]> {
	hints: string[];
	warnings: string[];
}

const kRowNumber = Symbol();

function removeOutliers(summary: Summary, mode: OutlierMode, row: FlattedResult) {
	const metrics = getMetrics(row);
	for (const [name, meta] of summary.meta) {
		if (meta.analyze !== 2) {
			continue;
		}
		const before = metrics[name] as number[];
		const after = new TukeyOutlierDetector(before).filter(before, mode);
		metrics[name] = after;

		if (before.length !== after.length) {
			const removed = before.length - after.length;
			summary.notes.push({
				type: "info",
				row,
				text: `${row.Name}: ${removed} outliers were removed.`,
			});
		}
	}
}

export function createTable(
	result: ToolchainResult[],
	diff: ToolchainResult[] | undefined,
	options: SummaryTableOptions = {},
	chalk: ChalkLike = noColors,
) {
	const { stdDev = false, percentiles = [], outliers = "upper", flexUnit = false, hideSingle = true } = options;
	const { baseline } = result[0];
	const summary = new Summary(result);
	const prev = new Summary(diff || []);

	// 1. Create columns
	const columnDefs: ColumnFactory[] = [new RowNumberColumn()];
	for (const [p, v] of summary.vars.entries()) {
		if (!hideSingle || v.size > 1) {
			columnDefs.push(new VariableColumn(p, chalk));
		}
	}
	for (const [name, meta] of summary.meta) {
		columnDefs.push(new RawMetricColumn(name, meta));
		if (meta.analyze === 0) {
			continue;
		}
		if (meta.analyze === 2) {
			if (stdDev) {
				columnDefs.push(new StdDevColumn(name, meta));
			}
			for (const k of percentiles) {
				columnDefs.push(new PercentileColumn(name, meta, k));
			}
		}
		if (baseline) {
			columnDefs.push(new BaselineColumn(name, meta, baseline));
		}
		if (prev.meta.has(name)) {
			columnDefs.push(new DifferenceColumn(prev, name, meta));
		}
	}

	// 2. Build the header
	const header = columnDefs.map(c => c.name);
	const table = [header] as TableWithNotes;
	table.hints = [];
	table.warnings = [];

	// 3. Fill the body
	let groups = [summary.table][Symbol.iterator]();
	if (baseline) {
		groups = summary.group(baseline.type).values();
	}
	for (const group of groups) {
		// 3-1. Preprocess
		if (outliers) {
			group.forEach(removeOutliers.bind(null, summary, outliers));
		}
		for (const metricColumn of columnDefs) {
			metricColumn.prepare?.(group);
		}

		// 3-2. Add values to cells
		const groupOffset = table.length;
		for (const data of group) {
			const cells: any[] = [];
			table.push(cells);
			for (const column of columnDefs) {
				cells.push(column.getValue(data, chalk));
			}
		}

		// 3-3. Postprocess
		const body = table.slice(groupOffset);
		for (let i = 0; i < columnDefs.length; i++) {
			const def = columnDefs[i];
			if (def.format) {
				formatColumn(body, i, def.format, flexUnit);
			}
		}

		table.push([]); // Add an empty row between groups.
	}

	// 4. Generate additional properties
	for (const note of summary.notes) {
		const scope = note.row ? `[No.${note.row[kRowNumber]}] ` : "";
		const msg = scope + note.text;
		if (note.type === "info") {
			table.hints.push(chalk.cyan(msg));
		} else {
			table.warnings.push(chalk.yellowBright(msg));
		}
	}

	table.pop();
	return table as TableWithNotes;
}

const formatRE = /\{(\w+)(?:\.(\w+))?}/ig;

type FormatFn = (value: any) => string;
type GetFormatter = (flex: boolean, values: any[], unit?: string) => FormatFn;

function normalFormatter(this: UnitConvertor<readonly any[]>, flex: boolean, values: any[], unit?: string) {
	if (flex) {
		return (value: number) => insertThousandCommas(this.formatDiv(value, unit));
	}
	const format = this.homogeneous(values, unit);
	return (value: number) => insertThousandCommas(format(value));
}

const formatters: Record<string, GetFormatter> = {
	number: normalFormatter.bind(decimalPrefix),
	duration: normalFormatter.bind(durationFmt),
	dataSize: normalFormatter.bind(dataSizeIEC),
};

function formatColumn(table: any[][], column: number, format: string, flex: boolean) {
	const values = table.map(r => r[column]);
	const s = format.split(formatRE);
	const p = Array.from(format.matchAll(formatRE))
		.map(([, type, unit]) => formatters[type](flex, values, unit));

	for (const row of table) {
		const parts = [];
		for (let i = 0; i < p.length; i++) {
			parts.push(s[i]);
			parts.push(p[i](row[column]));
		}
		parts.push(s[s.length - 1]);
		row[column] = parts.join("");
	}
}
