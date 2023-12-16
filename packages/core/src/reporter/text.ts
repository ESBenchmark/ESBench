import { createWriteStream } from "fs";
import { stdout } from "process";
import { Writable } from "stream";
import chalk, { Chalk, ChalkInstance } from "chalk";
import { durationFmt } from "@kaciras/utilities/node";
import { mean, quantileSorted, standardDeviation } from "simple-statistics";
import { markdownTable } from "markdown-table";
import stringLength from "string-width";
import { ESBenchResult, SummaryTableFilter } from "../client/collect.js";
import { Reporter } from "../config.js";
import { OutlierMode, TukeyOutlierDetector } from "../client/math.js";

async function print(result: ESBenchResult, options: TextReporterOptions, out: Writable, chalk: ChalkInstance) {
	const { stdDev = false, percentiles = [], outliers = "upper" } = options;
	const entries = Object.entries(result);
	out.write(chalk.blueBright(`Text reporter: Format benchmark results of ${entries.length} suites:`));

	for (const [name, stages] of entries) {
		const stf = new SummaryTableFilter(stages);
		const header = [...stf.vars.keys()];

		for (let i = 0; i < stf.builtinParams.length; i++) {
			header[i] = chalk.cyan(header[i]);
		}
		for (let i = stf.builtinParams.length; i < header.length; i++) {
			header[i] = chalk.magentaBright(header[i]);
		}
		header.push("time");
		if (stdDev) {
			header.push("stdDev");
		}
		for (const k of percentiles) {
			header.push("p" + k);
		}

		const table = [header];
		const hints = [];

		const { baseline } = stages[0];
		let groups = [stf.table][Symbol.iterator]();

		if (baseline) {
			groups = stf.groupBy(baseline.type).values();
			header.push("ratio");
		}

		for (const group of groups) {
			const ratio1Row = group.find(d => d[baseline!.type] === baseline!.value);
			if (!ratio1Row && baseline) {
				throw new Error(`Baseline (${baseline.type}=${baseline.value}) does not in the table`);
			}
			const ratio1 = ratio1Row ? stf.getMetrics(ratio1Row) : null;

			for (const data of group) {
				const columns: string[] = [];
				table.push(columns);

				for (const k of stf.vars.keys()) {
					columns.push("" + data[k]);
				}

				const rawTime = stf.getMetrics(data).time;
				let time = rawTime;
				if (outliers) {
					time = new TukeyOutlierDetector(rawTime).filter(rawTime, outliers);
				}

				if (rawTime.length !== time.length) {
					const removed = rawTime.length - time.length;
					hints.push(`${data.Name}: ${removed} outliers were removed.`);
				}
				columns.push(fmtTime(mean(time)));

				if (stdDev) {
					columns.push(fmtTime(standardDeviation(time)));
				}
				for (const k of percentiles) {
					columns.push(fmtTime(quantileSorted(time, k / 100)));
				}

				if (ratio1Row) {
					const ratio = mean(rawTime) / mean(ratio1!.time);
					columns.push(`${ratio.toFixed(2)}x`);
				}
			}
			table.push(new Array(header.length));
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
