import { createWriteStream } from "fs";
import { stdout } from "process";
import { Writable } from "stream";
import chalk, { Chalk, ChalkInstance } from "chalk";
import { durationFmt } from "@kaciras/utilities/node";
import { mean, quantileSorted, standardDeviation } from "simple-statistics";
import { markdownTable } from "markdown-table";
import stringLength from "string-width";
import { ESBenchResult, flatSummary, FlattedResult } from "../client/collect.js";
import { Reporter } from "../config.js";

async function print(result: ESBenchResult, options: TextReporterOptions, out: Writable, chalk: ChalkInstance) {
	const { stdDev = false, percentiles = [] } = options;
	const entries = Object.entries(result);
	out.write(chalk.blueBright(`Text reporter: Format benchmark results of ${entries.length} suites:`));

	for (const [name, stages] of entries) {
		const flatted = flatSummary(stages);
		const stageKeys: Array<keyof FlattedResult> = ["name"];
		if (flatted.builders.size > 1) {
			stageKeys.push("builder");
		}
		if (flatted.engines.size > 1) {
			stageKeys.push("engine");
		}

		const header: string[] = [...stageKeys];
		for (const key of flatted.pKeys) {
			header.push(chalk.magentaBright(key));
		}
		header.push("time");
		if (stdDev) {
			header.push("stdDev");
		}
		for (const k of percentiles) {
			header.push("p" + k);
		}

		out.write(chalk.greenBright("\n\nSuite: "));
		out.write(name);

		const table = [header];
		for (const data of flatted.list) {
			const column: string[] = [];
			table.push(column);

			for (const k of stageKeys) {
				column.push(data[k] as string);
			}
			for (const k of flatted.pKeys) {
				column.push("" + data.params[k]);
			}

			const time = data.metrics.time.sort((a, b) => a - b);
			column.push(fmtTime(mean(time)));

			if (stdDev) {
				column.push(fmtTime(standardDeviation(time)));
			}
			for (const k of percentiles) {
				column.push(fmtTime(quantileSorted(time, k / 100)));
			}
		}

		out.write("\n");
		out.write(markdownTable(table, { stringLength, align: "r" }));
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
	 * Show standard deviation columns in the report.
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
