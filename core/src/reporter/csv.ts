import { createWriteStream, mkdirSync, WriteStream } from "fs";
import { dirname } from "path";
import { Reporter } from "../host/config.js";
import { buildSummaryTable, SummaryTable, SummaryTableOptions } from "../table.js";

export interface CSVReporterOptions extends SummaryTableOptions {
	/**
	 * Path of the directory to save the CSV files.
	 */
	directory?: string;
}

function writeCSVToStream(table: SummaryTable, out: WriteStream) {
	for (const row of table) {
		if (row.length === 0) {
			continue;
		}
		for (const cell of row) {
			let v = cell.toString();
			if (/[\r\n",]/.test(v)) {
				v = '"' + v.replaceAll('"', '""') + '"';
			}
			out.write(v);
			out.write(",");
		}
		out.write("\r\n");
	}
}

/**
 * Format the results into text and output to various streams.
 */
export default function (options: CSVReporterOptions = {}): Reporter {
	const { directory = "reports" } = options;
	options.format ??= false;

	function openWrite(name: string) {
		const filename = `${directory}/${name}.csv`;
		mkdirSync(dirname(filename), { recursive: true });
		return createWriteStream(filename);
	}

	return async (result, previous) => {
		const entries = Object.entries(result);
		for (const [name, results] of entries) {
			const diff = previous?.[name];
			const table = buildSummaryTable(results, diff, options);

			const fp = openWrite(name);
			writeCSVToStream(table, fp);
			fp.end().close();
		}
		console.log(`${entries.length} CSV files saved at ${directory}/`);
	};
}
