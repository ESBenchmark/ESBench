import { chromium } from "playwright-core";
import { defineConfig, PlaywrightEngine, ViteBuilder } from "@esbench/core";
import htmlReporter from "@esbench/reporter-html";

export default defineConfig({
	include: ["./src/run.js"],
	stages: [{
		builder: new ViteBuilder(),
		engines: [
			// new DirectEngine(),
			new PlaywrightEngine(chromium, {
				headless: false,
				executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
			}),
			// new NodeEngine(),
			// new ProcessEngine("node"),
		],
	}],
	reporters: [
		htmlReporter({ file: "temp/report.html", open: true }),
	],
});
