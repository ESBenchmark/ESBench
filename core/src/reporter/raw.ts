import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import { Reporter } from "../host/config.js";

export const DEFAULT_NAME = "reports/benchmark_[date]_[time].json";

/**
 * Save the result object as a JSON file.
 *
 * The name pattern support the following placeholders:
 * [date]: report date, e.g. "2023-11-01"
 * [time]: report time, e.g. "20-13-51"
 *
 * @example
 * // The file name is like: result_2023-11-01_20-13-51.json
 * export default defineConfig({
 *     reporters: [
 *         rawReporter("result_[date]_[time].json"),
 *     ],
 * });
 *
 * @param name The pattern to use for naming result file.
 */
export default function (name = DEFAULT_NAME): Reporter {
	const zoneOffset = new Date().getTimezoneOffset() * 60 * 1000;

	return result => {
		const now = new Date(Date.now() - zoneOffset);
		const [date, time] = now.toISOString().split("T");
		const file = name
			.replaceAll("[date]", date)
			.replaceAll("[time]", time.slice(0, -5).replaceAll(":", "-"));

		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, JSON.stringify(result));
		console.info("Benchmark result saved to: " + file);
	};
}