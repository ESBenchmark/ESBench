import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Reporter } from "../host/config.js";

const DEFAULT_NAME = "reports/benchmark.json";

/**
 * Save the result object as a JSON file.
 *
 * The name pattern support the following placeholders:
 * [date]: report date, e.g. "2023-11-01"
 * [time]: report time, e.g. "20-13-51"
 *
 * @example
 * // The file name is like: results_2023-11-01_20-13-51.json
 * export default defineConfig({
 *     reporters: [
 *         rawReporter("benchmark_[date]_[time].json"),
 *     ],
 * });
 *
 * @param name The pattern to use for naming result file.
 * 			   Default is "reports/benchmark.json"
 */
export default function (name = DEFAULT_NAME): Reporter {
	const zoneOffset = new Date().getTimezoneOffset() * 60_000;

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
