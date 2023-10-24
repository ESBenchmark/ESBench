import { createWriteStream, writeFileSync } from "fs";
import * as csv from "csv-stringify";
import { Reporter } from "../config.js";

type ResultFileFormat = "json" | "csv";

export default function (file?: string, format: ResultFileFormat = "json"): Reporter {
	if (format === "json") {
		return result => writeFileSync(file ?? "benchmark.json", JSON.stringify(result));
	} else if (format === "csv") {
		return result => csv.stringify(result)
			.pipe(createWriteStream(file ?? "benchmark.csv"));
	} else {
		throw new TypeError(`Unknown format ${format}, supported values: (json|csv)`);
	}
}
