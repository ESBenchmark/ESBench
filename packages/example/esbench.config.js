import PlaywrightEngine from "@esbench/core/src/engine/playwright.js";
import { chromium, firefox, webkit } from "playwright-core";
import NodeEngine from "@esbench/core/src/engine/node.js";
import ProcessEngine from "@esbench/core/src/engine/process.js";
import DirectEngine from "@esbench/core/src/engine/direct.js";
import ViteTransformer from "@esbench/core/src/vite.js";

export default {
	include: ["./src/run.js"],
	scenes: [{
		transformer: new ViteTransformer(),
		engines: [
			new DirectEngine(),
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
