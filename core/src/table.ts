import type { ForegroundColorName } from "chalk";
import { mean, quantileSorted, standardDeviation } from "simple-statistics";
import {
	dataSizeIEC,
	decimalPrefix,
	durationFmt,
	identity,
	separateThousand,
	UnitConvertor,
} from "@kaciras/utilities/browser";
import { OutlierMode, TukeyOutlierDetector } from "./math.js";
import { MetricAnalysis, MetricMeta, Metrics } from "./context.js";
import { BaselineOptions } from "./suite.js";
import { BUILTIN_VARS } from "./utils.js";
import { FlattedResult, Summary, ToolchainResult } from "./summary.js";

const { getMetrics } = Summary;

type RatioStyle = "value" | "percentage" | "trend";

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
	 * If true, variables (expect Name) with only one value are not shown.
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

	/**
	 * Using ratioStyle, we can override the style of the diff and the baseline column.
	 *
	 * @example
	 *             "percentage"      "trend"       "value"
	 *      time | time.ratio | | time.ratio | | time.ratio |
	 * 117.26 us |      0.00% | |    100.00% | |      1.00x | (baseline)
	 * 274.14 us |   +133.79% | |    233.79% | |      2.34x |
	 *  19.82 us |    -83.10% | |     16.90% | |      0.17x |
	 *
	 * @default "percentage“
	 */
	ratioStyle?: RatioStyle;
}

type ANSIColor = Exclude<ForegroundColorName, "gray" | "grey">
type ChalkLike = Record<ANSIColor, (str: string) => string>;

const noColors = new Proxy<ChalkLike>(identity as any, { get: identity });

function styleRatio(v: number, style: RatioStyle, meta: MetricMeta, chalk: ChalkLike) {
	if (!Number.isFinite(v)) {
		return chalk.blackBright("N/A");
	}
	const color = v === 1
		? identity : (v < 1 === meta.lowerIsBetter)
			? chalk.green : chalk.red;

	switch (style) {
		case "trend":
			return color(`${(v * 100).toFixed(2)}%`);
		case "value":
			return color(`${v.toFixed(2)}x`);
		case "percentage":
			v = (v - 1) * 100;
			return color(v > 0 ? `+${v.toFixed(2)}%` : `${v.toFixed(2)}%`);
	}
}

interface ColumnFactory {

	name: string;

	format?: string;

	prepare?(cases: FlattedResult[]): void;

	getValue(data: FlattedResult, chalk: ChalkLike): any;
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
		if (!BUILTIN_VARS.includes(this.key)) {
			this.name = chalk.magentaBright(this.name);
		}
	}

	getValue(data: FlattedResult) {
		return data[this.key];
	}
}

class RawMetricColumn implements ColumnFactory {

	readonly meta: MetricMeta;
	readonly name: string;

	constructor(meta: MetricMeta) {
		this.meta = meta;
		this.name = meta.key;
	}

	get format() {
		return this.meta.format;
	}

	getValue(data: FlattedResult) {
		const metric = getMetrics(data)[this.name];
		return Array.isArray(metric) ? mean(metric) : metric;
	}
}

abstract class StatisticsColumn implements ColumnFactory {

	protected readonly meta: MetricMeta;

	abstract readonly name: string;

	constructor(meta: MetricMeta) {
		this.meta = meta;
	}

	get format() {
		return this.meta.format;
	}

	abstract calculate(values: number[]): number;

	getValue(data: FlattedResult) {
		const { key } = this.meta;
		const values = getMetrics(data)[key];
		if (Array.isArray(values)) {
			return this.calculate(values);
		}
		if (values !== undefined) {
			throw new TypeError(`Metric ${key} must be an array`);
		}
	}
}

class StdDevColumn extends StatisticsColumn {

	get name() {
		return this.meta.key + ".SD";
	}

	calculate(values: number[]) {
		return standardDeviation(values);
	}
}

class PercentileColumn extends StatisticsColumn {

	private readonly p: number;

	constructor(meta: MetricMeta, p: number) {
		super(meta);
		this.p = p;
	}

	get name() {
		return `${this.meta.key}.p${this.p}`;
	}

	calculate(values: number[]) {
		return quantileSorted(values, this.p / 100);
	}
}

class BaselineColumn implements ColumnFactory {

	private readonly meta: MetricMeta;
	private readonly variable: string;
	private readonly value: string;
	private readonly style: RatioStyle;

	private ratio1 = 0;

	constructor(meta: MetricMeta, baseline: BaselineOptions, style: RatioStyle) {
		this.meta = meta;
		this.variable = baseline.type;
		this.value = baseline.value;
		this.style = style;
	}

	get name() {
		return this.meta.key + ".ratio";
	}

	private toNumber(data: FlattedResult) {
		const metric = getMetrics(data)[this.meta.key];
		if (Array.isArray(metric)) {
			return mean(metric);
		}
		return typeof metric === "number" ? metric : 0;
	}

	prepare(cases: Iterable<FlattedResult>) {
		const { variable, value } = this;
		for (const row of cases) {
			if (row[variable] === value) {
				return this.ratio1 = this.toNumber(row);
			}
		}
		throw new Error(`Baseline (${variable}=${value}) does not in the table`);
	}

	getValue(data: FlattedResult, chalk: ChalkLike) {
		const { ratio1, meta } = this;

		const ratio = this.toNumber(data) / ratio1;
		return styleRatio(ratio, this.style, meta, chalk);
	}
}

class DifferenceColumn implements ColumnFactory {

	private readonly another: Summary;
	private readonly meta: MetricMeta;
	private readonly style: RatioStyle;

	constructor(another: Summary, meta: MetricMeta, style: RatioStyle) {
		this.another = another;
		this.meta = meta;
		this.style = style;
	}

	get name() {
		return `${this.meta.key}.diff`;
	}

	private toNumber(data: Metrics): number | undefined {
		const metric = data[this.meta.key];
		return Array.isArray(metric) ? mean(metric) : metric as number;
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
		return styleRatio(c / p, this.style, this.meta, chalk);
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
		if (meta.analysis !== MetricAnalysis.Statistics) {
			continue;
		}
		const before = metrics[name];
		if (!Array.isArray(before)) {
			continue;
		}
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
	diff?: ToolchainResult[],
	options: SummaryTableOptions = {},
	chalk: ChalkLike = noColors,
) {
	const {
		stdDev = false,
		percentiles = [],
		outliers = "upper",
		flexUnit = false,
		hideSingle = true,
		ratioStyle = "percentage",
	} = options;

	const summary = new Summary(result);
	const prev = new Summary(diff || []);
	const { baseline } = summary;

	// 1. Create columns
	const columnDefs: ColumnFactory[] = [new RowNumberColumn()];
	for (const [p, v] of summary.vars.entries()) {
		if (!hideSingle || v.size > 1 || p === "Name") {
			columnDefs.push(new VariableColumn(p, chalk));
		}
	}
	for (const meta of summary.meta.values()) {
		columnDefs.push(new RawMetricColumn(meta));
		if (!meta.analysis /* 0 or undefined */) {
			continue;
		}
		if (meta.analysis === MetricAnalysis.Statistics) {
			if (stdDev) {
				columnDefs.push(new StdDevColumn(meta));
			}
			for (const k of percentiles) {
				columnDefs.push(new PercentileColumn(meta, k));
			}
		}
		if (baseline) {
			columnDefs.push(new BaselineColumn(meta, baseline, ratioStyle));
		}
		if (prev.meta.has(meta.key)) {
			columnDefs.push(new DifferenceColumn(prev, meta, ratioStyle));
		}
	}

	// 2. Build the header
	const header = columnDefs.map(c => c.name);
	const table = [header] as TableWithNotes;
	table.hints = [];
	table.warnings = [];

	// 3. Fill the body
	const groups = baseline
		? summary.group(baseline.type).values()
		: [summary.table];

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

function unitFormatter(
	this: UnitConvertor<readonly any[]>,
	flex: boolean,
	values: any[],
	unit?: string,
) {
	if (flex) {
		return (value: number) => separateThousand(this.formatDiv(value, unit));
	}
	const format = this.homogeneous(values, unit);
	return (value: number) => separateThousand(format(value));
}

const formatters: Record<string, GetFormatter> = {
	number: unitFormatter.bind(decimalPrefix),
	duration: unitFormatter.bind(durationFmt),
	dataSize: unitFormatter.bind(dataSizeIEC),
};

function formatColumn(table: any[][], column: number, format: string, flex: boolean) {
	const values = table.map(r => r[column]).filter(v => v !== undefined);
	const s = format.split(formatRE);
	const p: FormatFn[] = [];

	for (const [, type, unit] of format.matchAll(formatRE)) {
		p.push(formatters[type](flex, values, unit));
	}

	for (const row of table) {
		const value = row[column];
		if (value === undefined) {
			row[column] = "";
		} else {
			const parts = [];
			for (let i = 0; i < p.length; i++) {
				parts.push(s[i]);
				parts.push(p[i](value));
			}
			parts.push(s[s.length - 1]);
			row[column] = parts.join("");
		}
	}
}
