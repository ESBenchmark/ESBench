import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Reporter } from "../host/config.js";
import { ESBenchResult } from "../connect.js";

// This file is generated from packages/reporter-html.
const dist = join(fileURLToPath(import.meta.url), "../../../lib/reporter/index.html");

/**
 * Plot the results into an interactive chart.
 *
 * @param file filename of the html report, default is "reports/benchmark.html"
 */
export default function (file = "reports/benchmark.html"): Reporter {
	const template = readFileSync(dist, "utf8");

	function interpolate(html: string, p: string, r: ESBenchResult) {
		const code = JSON.stringify(r);
		return html.replace(
			`<!--ESBench-${p}-->`,
			`<script>window.${p}=${code}</script>`,
		);
	}

	return (result, context) => {
		let html = interpolate(template, "Result", result);
		html = interpolate(html, "Previous", context.previous);

		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, html);

		const { href } = pathToFileURL(file);
		context.info("HTML report can be found at: " + href);
	};
}
