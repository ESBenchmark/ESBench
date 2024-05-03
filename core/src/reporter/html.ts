import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import openBrowser from "open";
import { ESBenchResult } from "../connect.js";

export interface HtmlReporterOptions {
	/**
	 * The name of the reporter file should be saved to.
	 *
	 * @default "reports/benchmark.html"
	 */
	file?: string;

	/**
	 * Automatically open the report in the browser.
	 *
	 * @default false
	 */
	open?: boolean;
}

// This file is generated from packages/reporter-html.
const dist = join(fileURLToPath(import.meta.url), "../index.html");

export default function (options: HtmlReporterOptions = {}) {
	const { file = "reports/benchmark.html", open } = options;
	const template = readFileSync(dist, "utf8");

	function interpolate(html: string, p: string, r: ESBenchResult) {
		const code = JSON.stringify(r);
		return html.replace(`<!--ESBench-${p}-->`, `<script>window.${p}=${code}</script>`);
	}

	return async (result: ESBenchResult, prev: ESBenchResult) => {
		let html = interpolate(template, "Result", result);
		if (prev) {
			html = interpolate(html, "Previous", prev);
		}
		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, html);

		const url = pathToFileURL(file).toString();
		if (open) {
			await openBrowser(url);
		}
		console.info("HTML report can be found at: " + url);
	};
}
