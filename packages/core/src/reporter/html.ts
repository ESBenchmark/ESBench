import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import openBrowser from "open";
import { ESBenchResult } from "../client/index.js";

export interface HtmlReporterOptions {
	file?: string;
	open?: boolean;
}

// This file is generated from packages/reporter-html.
const dist = join(fileURLToPath(import.meta.url), "../../html/index.html");

export default function htmlReporter(options: HtmlReporterOptions = {}) {
	const { file = "benchmark.html", open } = options;
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
