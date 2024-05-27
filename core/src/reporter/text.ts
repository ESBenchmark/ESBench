import { createWriteStream } from "fs";
import { stdout } from "process";
import { Writable } from "stream";
import chalk, { Chalk } from "chalk";
import stringLength from "string-width";
import { ESBenchResult } from "../connect.js";
import { Reporter } from "../host/config.js";
import { buildSummaryTable, FormatOptions, SummaryTableOptions } from "../table.js";

export interface TextReporterOptions extends SummaryTableOptions, FormatOptions {
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

function print(
	result: ESBenchResult,
	previous: ESBenchResult,
	options: TextReporterOptions,
	out: Writable,
) {
	const entries = Object.entries(result);
	out.write(chalk.blueBright(`Text reporter: Format benchmark results of ${entries.length} suites:`));

	for (const [name, toolchains] of entries) {
		const diff = previous[name];
		const table = buildSummaryTable(toolchains, diff, options);

		out.write(chalk.greenBright("\nSuite: "));
		out.write(name);
		out.write("\n");
		out.write(table.format(options).toMarkdown(stringLength));
		out.write("\n");

		if (table.hints.length > 0) {
			out.write(chalk.cyan("Hints:\n"));
			for (const note of table.hints) {
				out.write(chalk.cyan(note));
				out.write("\n");
			}
		}

		if (table.warnings.length > 0) {
			out.write(chalk.yellowBright("Warnings:\n"));
			for (const note of table.warnings) {
				out.write(chalk.yellowBright(note));
				out.write("\n");
			}
		}

		out.write("\n");
	}
}

/**
 * Format the results into text and output to various streams.
 */
export default function (options: TextReporterOptions = {}): Reporter {
	const { file, console = true } = options;
	return (result, prev) => {
		if (console) {
			options.chalk = chalk;
			print(result, prev, options, stdout);
		}
		if (file) {
			const stream = createWriteStream(file);
			options.chalk = new Chalk({ level: 0 });
			print(result, prev, options, stream);
		}
	};
}
