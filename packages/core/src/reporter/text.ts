import { createWriteStream } from "fs";
import { stdout } from "process";
import { Writable } from "stream";
import chalk, { Chalk, ChalkInstance } from "chalk";
import { durationFmt } from "@kaciras/utilities/node";
import { mean, quantileSorted, standardDeviation } from "simple-statistics";
import { markdownTable } from "markdown-table";
import stringLength from "string-width";
import { ESBenchResult, FlattedCase, SummaryTableFilter } from "../client/collect.js";
import { Reporter } from "../config.js";
import { OutlierMode, TukeyOutlierDetector } from "../client/math.js";
import { BaselineOptions, Metrics } from "../client/index.js";

interface MetricColumnFactory {

	name: string;

	prepare?(stf: SummaryTableFilter, cases: FlattedCase[]): void;

	build(metrics: Metrics): string;
}

class BaselineColumn implements MetricColumnFactory {

	readonly name = "ratio";

	private readonly key: string;
	private readonly value: string;

	private ratio1 = 0;

	constructor(baseline: BaselineOptions) {
		this.key = baseline.type;
		this.value = baseline.value;
	}

	prepare(stf: SummaryTableFilter, cases: FlattedCase[]) {
		const { key, value } = this;
		const ratio1Row = cases.find(d => d[key] === value);
		if (!ratio1Row) {
			throw new Error(`Baseline (${key}=${value}) does not in the table`);
		}
		this.ratio1 = mean(stf.getMetrics(ratio1Row).time);
	}

	build(metrics: Metrics) {
		const ratio = mean(metrics.time) / this.ratio1;
		const text = `${ratio.toFixed(2)}x`;
		if (ratio === 1) {
			return text;
		}
		return ratio < 1 ? chalk.green(text) : chalk.red(text);
	}
}

const meanColumn: MetricColumnFactory = {
	name: "time",
	build(metrics: Metrics): string {
		return fmtTime(mean(metrics.time));
	},
};

const stdDevColumn: MetricColumnFactory = {
	name: "stdDev",
	build(metrics: Metrics): string {
		return fmtTime(standardDeviation(metrics.time));
	},
};

class PercentileColumn implements MetricColumnFactory {

	readonly p: number;
	readonly name: string;

	constructor(p: number) {
		this.p = p / 100;
		this.name = "p" + p;
	}

	build(metrics: Metrics) {
		return fmtTime(quantileSorted(metrics.time, this.p));
	}
}

async function print(result: ESBenchResult, options: TextReporterOptions, out: Writable, chalk: ChalkInstance) {
	const { stdDev = false, percentiles = [], outliers = "upper" } = options;
	const entries = Object.entries(result);
	out.write(chalk.blueBright(`Text reporter: Format benchmark results of ${entries.length} suites:`));

	for (const [name, stages] of entries) {
		const stf = new SummaryTableFilter(stages);
		const { baseline } = stages[0];

		const metricColumns: MetricColumnFactory[] = [meanColumn];
		if (stdDev) {
			metricColumns.push(stdDevColumn);
		}
		for (const k of percentiles) {
			metricColumns.push(new PercentileColumn(k));
		}
		if (baseline) {
			metricColumns.push(new BaselineColumn(baseline));
		}

		const header = [...stf.vars.keys()];
		for (let i = stf.builtinParams.length; i < header.length; i++) {
			header[i] = chalk.magentaBright(header[i]);
		}
		for (const metricColumn of metricColumns) {
			header.push(chalk.cyan(metricColumn.name));
		}

		const table = [header];
		const hints: string[] = [];

		let groups = [stf.table][Symbol.iterator]();
		if (baseline) {
			groups = stf.groupBy(baseline.type).values();
		}

		for (const group of groups) {
			for (const data of group) {
				removeOutliers(data, stf.getMetrics(data));
			}
			for (const metricColumn of metricColumns) {
				metricColumn.prepare?.(stf, group);
			}
			for (const data of group) {
				const columns: string[] = [];
				table.push(columns);

				for (const k of stf.vars.keys()) {
					columns.push("" + data[k]);
				}
				const metrics = stf.getMetrics(data);
				for (const metricColumn of metricColumns) {
					columns.push(metricColumn.build(metrics));
				}
			}
			table.push(new Array(header.length));
		}

		function removeOutliers(data: FlattedCase, metrics: Metrics){
			const rawTime = metrics.time;
			if (outliers) {
				metrics.time = new TukeyOutlierDetector(rawTime).filter(rawTime, outliers);
			}
			if (rawTime.length !== metrics.time.length) {
				const removed = rawTime.length - metrics.time.length;
				hints.push(`${data.Name}: ${removed} outliers were removed.`);
			}
		}

		table.pop();

		out.write(chalk.greenBright("\n\nSuite: "));
		out.write(name);
		out.write("\n");
		out.write(markdownTable(table, { stringLength, align: "r" }));
		out.write("\n");
		out.write("\nHints:\n");
		for (const hint of hints) {
			out.write(hint);
			out.write("\n");
		}
	}
}

function fmtTime(ms: number) {
	return durationFmt.formatDiv(ms, "ms");
}

export interface TextReporterOptions {
	/**
	 * Write the report to a text file.
	 */
	file?: string;

	/**
	 * Set to false to disable print the report to console.
	 *
	 * @default true
	 */
	console?: boolean;

	/**
	 * Show standard deviation (SD) columns in the report.
	 */
	stdDev?: boolean;

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

export default function (options: TextReporterOptions = {}): Reporter {
	const { file, console = true } = options;
	return async result => {
		if (console) {
			await print(result, options, stdout, chalk);
		}
		if (file) {
			const stream = createWriteStream(file);
			await print(result, options, stream, new Chalk({ level: 0 }));
		}
	};
}
