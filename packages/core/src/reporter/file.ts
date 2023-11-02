import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { Reporter } from "../config.js";

/**
 * Save the result object as a JSON file.
 *
 * The name pattern support the following placeholders:
 * [date]: report date, e.g. "2023-11-01"
 * [time]: report time, e.g. "20-13-51"
 *
 * @param name The pattern to use for naming result file.
 */
export default function (name = "reports/benchmark_[date]_[time].json"): Reporter {
	const zoneOffset = new Date().getTimezoneOffset() * 60 * 1000;

	return result => {
		const now = new Date(Date.now() - zoneOffset);
		const [date, time] = now.toISOString().split("T");
		const file = name
			.replaceAll("[date]", date)
			.replaceAll("[time]", time.slice(0, -5).replaceAll(":", "-"));

		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, JSON.stringify(result));
	};
}
