import { stdout } from "process";
import { createWriteStream } from "fs";
import { Writable } from "stream";
import chalk, { Chalk, ChalkInstance } from "chalk";
import { durationFmt } from "@kaciras/utilities/node";
import { median } from "simple-statistics";
import { markdownTable } from "markdown-table";
import stringLength from "string-width";
import { ESBenchResult, flatSummary, FlattedResult } from "../client/collect.js";
import { Reporter } from "../config.js";

async function print(result: ESBenchResult, out: Writable, chalk: ChalkInstance) {
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

		out.write(chalk.greenBright("\n\nSuite: "));
		out.write(name);

		const table = [header];
		for (const data of flatted.list) {
			const column: string[] = [];
			table.push(column);

			for (const k of stageKeys) {
				column.push(data[k]);
			}
			for (const k of flatted.pKeys) {
				column.push("" + data.params[k]);
			}
			const time = median(data.metrics.time);
			column.push(durationFmt.formatDiv(time, "ms") + "/op");
		}

		out.write("\n");
		out.write(markdownTable(table, { stringLength, align: "r" }));
	}
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
}

export default function (options: TextReporterOptions = {}): Reporter {
	const { file, console = true } = options;
	return async result => {
		if (console) {
			await print(result, stdout, chalk);
		}
		if (file) {
			const stream = createWriteStream(file);
			await print(result, stream, new Chalk({ level: 0 }));
		}
	};
}
