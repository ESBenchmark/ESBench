import { defineConfig, DirectEngine, ViteBuilder } from "@esbench/core";
import htmlReporter from "@esbench/reporter-html";

export default defineConfig({
	include: ["./src/run.js"],
	stages: [{
		builder: new ViteBuilder(),
		engines: [
			// new PlaywrightEngine(chromium, {
			// 	headless: false,
			// 	executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
			// }),
			new DirectEngine(),
			// new ProcessEngine("node"),
		],
	}],
	reporters: [
		htmlReporter({ file: "temp/report.html" }),
	],
});
