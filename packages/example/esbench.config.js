import PlaywrightEngine from "@esbench/core/src/engine/playwright.js";
import { chromium } from "playwright-core";
import ViteTransformer from "@esbench/core/src/builder/vite.js";

export default {
	include: ["./src/run.js"],
	stages: [{
		builder: new ViteTransformer(),
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
	// reporter: "console",
};
