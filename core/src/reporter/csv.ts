import { createWriteStream, mkdirSync, WriteStream } from "fs";
import { dirname } from "path";
import { Reporter } from "../host/config.js";
import { buildSummaryTable, SummaryTableOptions } from "../table.js";

export interface CSVReporterOptions extends SummaryTableOptions {
	/**
	 * Path of the directory to save the CSV files.
	 */
	directory?: string;
}

function writeRow(row: any[], out: WriteStream) {
	for (const cell of row) {
		if (!row) {
			continue;
		}
		let v = cell.toString();
		if (/[\r\n",]/.test(v)) {
			v = '"' + v.replaceAll('"', '""') + '"';
		}
		out.write(v);
		out.write(",");
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

	return async (result, previous) => {
		const entries = Object.entries(result);
		for (const [name, results] of entries) {
			const diff = previous?.[name];
			const table = buildSummaryTable(results, diff, options);

			const fp = openWrite(name);
			writeRow(table.header, fp);
			for (const row of table.body) {
				writeRow(row, fp);
			}
			fp.end("\r\n").close();
		}
		console.log(`${entries.length} CSV files saved at ${directory}/`);
	};
}
