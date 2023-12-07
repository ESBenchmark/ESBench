import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import openBrowser from "open";
import { ESBenchResult } from "../client/collect.js";

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
const dist = join(fileURLToPath(import.meta.url), "../../html/index.html");

export default function (options: HtmlReporterOptions = {}) {
	const { file = "reports/benchmark.html", open } = options;
	const template = readFileSync(dist, "utf8");

	return async (result: ESBenchResult) => {
		const code = JSON.stringify(result);
		const html = template.replace(
			"<!--ESBench-Result-->",
			`<script>window.ESBenchResult=${code}</script>`,
		);

		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, html);

		const url = pathToFileURL(file).toString();
		if (open) {
			await openBrowser(url);
		}
		console.info("HTML report can be found at: " + url);
	};
}
