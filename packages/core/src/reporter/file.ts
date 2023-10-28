import { createWriteStream, writeFileSync } from "fs";
import * as csv from "csv-stringify";
import { Reporter } from "../config.js";
import { flatResult } from "../client/collect.js";

type ResultFileFormat = "json" | "csv";

export default function (file?: string, format: ResultFileFormat = "json"): Reporter {
	if (format === "json") {
		return result => writeFileSync(file ?? "benchmark.json", JSON.stringify(result));
	} else if (format === "csv") {
		return result => csv.stringify(Array.from(flatResult(result)))
			.pipe(createWriteStream(file ?? "benchmark.csv"));
	} else {
		throw new TypeError(`Unknown format ${format}, supported values: (json|csv)`);
	}
}
