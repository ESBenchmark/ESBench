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

async function print(result: ESBenchResult, options: TextReporterOptions, out: Writable, chalk: ChalkInstance) {
	const entries = Object.entries(result);
	out.write(chalk.blueBright(`Text reporter: Format benchmark results of ${entries.length} suites:`));

	for (const [name, toolchains] of entries) {
		const table = createTable(toolchains, options, chalk);

		out.write(chalk.greenBright("\n\nSuite: "));
		out.write(name);
		out.write("\n");
		out.write(markdownTable(table, { stringLength, align: "r" }));
		out.write("\n");
		out.write("\nHints:\n");
		for (const hint of table.hints) {
			out.write(hint);
			out.write("\n");
		}
	}
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
