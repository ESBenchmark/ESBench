import { createWriteStream, mkdirSync, WriteStream } from "fs";
import { finished } from "stream";
import { promisify } from "util";
import { dirname } from "path";
import { Reporter } from "../host/config.js";
import { buildSummaryTable, SummaryTableOptions } from "../table.js";

const finishedAsync = promisify(finished);

export interface CSVReporterOptions extends SummaryTableOptions {
	/**
	 * Path of the directory to save the CSV files.
	 */
	directory?: string;
}

function writeRow(row: any[], out: WriteStream) {
	const e = row.length - 1;
	for (let i = 0; i <= e; i++) {
		const value = row[i];
		if (value === undefined) {
			continue;
		}
		let v = value.toString();
		if (/[\r\n",]/.test(v)) {
			v = '"' + v.replaceAll('"', '""') + '"';
		}
		out.write(v);
		if (i !== e) {
			out.write(",");
		}
	}
}

/**
 * Format the results into text and output to various streams.
 */
export default function (options: CSVReporterOptions = {}): Reporter {
	const { directory = "reports" } = options;

	function openWrite(name: string) {
		const filename = `${directory}/${name}.csv`;
		mkdirSync(dirname(filename), { recursive: true });
		return createWriteStream(filename);
	}

	return async (result, previous, logger) => {
		const entries = Object.entries(result);
		for (const [name, results] of entries) {
			const diff = previous[name];
			const table = buildSummaryTable(results, diff, options);

			const fp = openWrite(name);
			for (const row of table.cells) {
				writeRow(row, fp);
				fp.write("\r\n");
			}
			await finishedAsync(fp.end());
		}
		logger.info(`${entries.length} CSV files saved at ${directory}/`);
	};
}
