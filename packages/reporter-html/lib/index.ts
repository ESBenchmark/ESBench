import type { ESBenchResult } from "@esbench/core/client";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import openBrowser from "open";

export interface HtmlReporterOptions {
	file?: string;
	open?: boolean;
}

const dist = join(fileURLToPath(import.meta.url), "../../dist/index.html");

export function interpolate(html: string, data: ESBenchResult) {
	const code = JSON.stringify(data);
	return html.replace("<!--ESBench-Result-->", `<script>window.ESBenchResult=${code}</script>`);
}

export default function htmlReporter(options: HtmlReporterOptions = {}) {
	const { file = "benchmark.html", open } = options;
	const template = readFileSync(dist, "utf8");

	return async (result: ESBenchResult) => {
		const html = interpolate(template, result);

		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, html);

		const url = pathToFileURL(file).toString();
		if (open) {
			await openBrowser(url);
		}
		console.info("HTML report can be found at: " + url);
	};
}
