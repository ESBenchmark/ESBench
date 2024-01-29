import type { ForegroundColorName } from "chalk";
import { mean, quantileSorted, standardDeviation } from "simple-statistics";
import { dataSizeIEC, decimalPrefix, durationFmt, identity, UnitConvertor } from "@kaciras/utilities/browser";
import { OutlierMode, TukeyOutlierDetector } from "./math.js";
import { MetricMeta } from "./runner.js";
import { BaselineOptions } from "./suite.js";
import { addThousandCommas, BUILTIN_FIELDS } from "./utils.js";
import { FlattedResult, SummaryTableFilter, ToolchainResult } from "./collect.js";

const { getMetrics } = SummaryTableFilter;

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
	 * Show standard deviation (SD) columns in the report.
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
	 * export default defineConfig({
	 *     reporters: [
	 *         textReporter({ percentiles: [75, 99] }),
	 *     ],
	 * });
	 *
	 * |   name |    size |      time |       p75 |    p99 |
	 * | -----: | ------: | --------: | --------: | -----: |
	 * | object |    1000 | 938.45 ms | 992.03 ms | 1.08 s |
	 * |    map |    1000 |    1.03 s |    1.07 s |  1.1 s |
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

	readonly key: string;

	private readonly variable: string;
	private readonly value: string;

	private ratio1 = 0;

	constructor(key: string, baseline: BaselineOptions) {
		this.key = key;
		this.variable = baseline.type;
		this.value = baseline.value;
	}

	get name() {
		return this.key + ".Ratio";
	}

	private toNumber(data: FlattedResult) {
		const metric = getMetrics(data)[this.key];
		return Array.isArray(metric) ? mean(metric) : metric as number;
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
		const ratio = this.toNumber(data) / this.ratio1;
		if (!isFinite(ratio)) {
			return chalk.blackBright("N/A");
		}
		const text = `${ratio.toFixed(2)}x`;
		if (ratio === 1) {
			return text;
		}
		return ratio < 1 ? chalk.green(text) : chalk.red(text);
	}
}

class StdDevColumn implements ColumnFactory {

	readonly key: string;
	readonly format?: string;

	constructor(key: string, meta: MetricMeta) {
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

	constructor(key: string, meta: MetricMeta, p: number) {
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
		return `No.${this.index++}`;
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
	readonly meta: MetricMeta;

	constructor(name: string, meta: MetricMeta) {
		this.name = name;
		this.meta = meta;
	}

	get format() {
		return this.meta.format;
	}

	getValue(data: FlattedResult) {
		const metric = getMetrics(data)[this.name];
		return Array.isArray(metric) ? mean(metric) : metric;
	}
}

interface TableWithNotes extends Array<string[]> {
	hints: string[];
	warnings: string[];
}

const kRowNumber = Symbol();

function removeOutliers(stf: SummaryTableFilter, mode: OutlierMode, row: FlattedResult) {
	const metrics = getMetrics(row);
	for (const [name, meta] of stf.meta) {
		if (meta.analyze !== 2) {
			continue;
		}
		const before = metrics[name] as number[];
		const after = new TukeyOutlierDetector(before).filter(before, mode);
		metrics[name] = after;

		if (before.length !== after.length) {
			const removed = before.length - after.length;
			stf.notes.push({
				type: "info",
				row,
				text: `${row.Name}: ${removed} outliers were removed.`,
			});
		}
	}
}

export function createTable(result: ToolchainResult[], options: SummaryTableOptions = {}, chalk: ChalkLike = noColors) {
	const { stdDev = false, percentiles = [], outliers = "upper", flexUnit = false, hideSingle = true } = options;
	const { baseline } = result[0];
	const stf = new SummaryTableFilter(result);

	// 1. Create columns
	const columnDefs: ColumnFactory[] = [new RowNumberColumn()];
	for (const [p, v] of stf.vars.entries()) {
		if (!hideSingle || v.size > 1) {
			columnDefs.push(new VariableColumn(p, chalk));
		}
	}
	for (const [name, meta] of stf.meta) {
		columnDefs.push(new RawMetricColumn(name, meta));
		if (meta.analyze === 2) {
			if (stdDev) {
				columnDefs.push(new StdDevColumn(name, meta));
			}
			for (const k of percentiles) {
				columnDefs.push(new PercentileColumn(name, meta, k));
			}
		}
		if (baseline && meta.analyze !== 0) {
			columnDefs.push(new BaselineColumn(name, baseline));
		}
	}

	// 2. Build the header
	const header = columnDefs.map(c => c.name);
	const table = [header] as TableWithNotes;
	table.hints = [];
	table.warnings = [];

	// 3. Fill the body
	let groups = [stf.table][Symbol.iterator]();
	if (baseline) {
		groups = stf.group(baseline.type).values();
	}
	for (const group of groups) {
		// 3-1. Preprocess
		if (outliers) {
			group.forEach(removeOutliers.bind(null, stf, outliers));
		}
		for (const metricColumn of columnDefs) {
			metricColumn.prepare?.(group);
		}

		// 3-2. Add values to cells
		for (const data of group) {
			const cells: any[] = [];
			table.push(cells);
			for (const column of columnDefs) {
				cells.push(column.getValue(data, chalk));
			}
		}

		// 3-3. Postprocess
		const body = table.slice(1);
		for (let i = 0; i < columnDefs.length; i++) {
			const def = columnDefs[i];
			if (def.format) {
				formatTime(body, i, def.format, flexUnit);
			}
		}

		table.push([]); // Add an empty row between groups.
	}

	// 4. Generate additional properties
	for (const note of stf.notes) {
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

const formatters: Record<string, UnitConvertor<readonly any[]>> = {
	number: decimalPrefix,
	duration: durationFmt,
	dataSize: dataSizeIEC,
};

function formatTime(table: any[][], column: number, format: string, flex: boolean) {
	const p = Array.from(format.matchAll(formatRE));
	const s = format.split(formatRE);

	let pf: Array<(value: number) => string>;
	if (flex) {
		pf = p.map(([, type, unit]) => v => addThousandCommas(formatters[type].formatDiv(v, unit)));
	} else {
		pf = [];
		for (const [, type, unit] of p) {
			const fmt = formatters[type];
			const x = unit ? fmt.fractions[(fmt.units.indexOf(unit))] : 1;
			let min = Infinity;
			for (const row of table) {
				min = row[column] === 0 // 0 is equal in any unit.
					? min
					: Math.min(min, fmt.suit(row[column] * x));
			}
			if (min === Infinity) {
				min = 0; // All values are 0, use the minimum unit.
			}
			const scale = x / fmt.fractions[min];
			const newUnit = fmt.units[min];

			pf.push(v => addThousandCommas((v * scale).toFixed(2) + " " + newUnit));
		}
	}

	for (const row of table) {
		const parts = [];
		for (let i = 0; i < pf.length; i++) {
			parts.push(s[i]);
			parts.push(pf[i](row[column]));
		}
		parts.push(s[s.length - 1]);
		row[column] = parts.join("");
	}
}
