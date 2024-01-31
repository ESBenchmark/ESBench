import { createWriteStream } from "fs";
import { stdout } from "process";
import { Writable } from "stream";
import chalk, { Chalk, ChalkInstance } from "chalk";
import { markdownTable } from "markdown-table";
import stringLength from "string-width";
import { ESBenchResult } from "../client/collect.js";
import { Reporter } from "../config.js";
import { createTable, SummaryTableOptions } from "../client/table.js";

export interface TextReporterOptions extends SummaryTableOptions {
	/**
	 * Write the report to a text file.
	 */
	file?: string;

	/**
	 * Set to false to disable print the report to console.
	 * @default true
	 */
	console?: boolean;
}

async function print(
	result: ESBenchResult,
	previous: ESBenchResult | undefined,
	options: TextReporterOptions,
	out: Writable,
	chalk: ChalkInstance,
) {
	const entries = Object.entries(result);
	out.write(chalk.blueBright(`Text reporter: Format benchmark results of ${entries.length} suites:`));

	for (const [name, toolchains] of entries) {
		const diff = previous?.[name];
		const table = createTable(toolchains, diff, options, chalk);

		out.write(chalk.greenBright("\n\nSuite: "));
		out.write(name);
		out.write("\n");
		out.write(markdownTable(table, { stringLength, align: "r" }));
		out.write("\n");

		if (table.hints.length > 0) {
			out.write(chalk.cyan("Hints:\n"));
			for (const note of table.hints) {
				out.write(note);
				out.write("\n");
			}
		}

		if (table.warnings.length > 0) {
			out.write(chalk.yellowBright("Warnings:\n"));
			for (const note of table.warnings) {
				out.write(note);
				out.write("\n");
			}
		}
	}
}

export default function (options: TextReporterOptions = {}): Reporter {
	const { file, console = true } = options;
	return async (result, prev) => {
		if (console) {
			await print(result, prev, options, stdout, chalk);
		}
		if (file) {
			const stream = createWriteStream(file);
			await print(result, prev, options, stream, new Chalk({ level: 0 }));
		}
	};
}
