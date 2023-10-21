import type { ESBenchResult } from "@esbench/core/client";
import { join } from "path";
import { fileURLToPath } from "url";
import { cpSync, existsSync, readFileSync, writeFileSync } from "fs";

export interface HtmlReporterOptions {
	outDir?: string;
}

const dist = join(fileURLToPath(import.meta.url), "../../dist");

export function interpolate(html: string, data: ESBenchResult) {
	const code = JSON.stringify(data);
	return html.replace("<!--ESBench-Result-->", `<script>window.ESBenchResult=${code}</script>`);
}

export default function htmlReporter(options: HtmlReporterOptions = {}) {
	const { outDir = "esbench" } = options;
	const template = readFileSync(join(dist, "index.html"), "utf8");

	return (result: ESBenchResult) => {
		const html = interpolate(template, result);

		const assets = join(outDir, "assets");
		if (!existsSync(assets)) {
			cpSync(join(dist, "assets"), assets, { recursive: true });
		}

		const file = join(outDir, "benchmark.html");
		writeFileSync(file, html);
		console.info("HTML report saved to " + file);
	};
}
