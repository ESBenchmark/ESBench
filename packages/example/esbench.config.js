import { PlaywrightEngine, chromium } from "@esbench/core/src/runner/playwright.js";
import NodeEngine from "@esbench/core/src/runner/node.js";
import ProcessEngine from "@esbench/core/src/runner/process.js";
import DirectEngine from "@esbench/core/src/runner/direct.js";
import ViteTransformer from "@esbench/core/src/vite.js";

export default {
	include: ["./src/run.js"],
	scenes: [{
		transformer: new ViteTransformer(),
		engines: [
			new DirectEngine(),
			// new PlaywrightRunner(chromium, {
			// 	headless: false,
			// 	executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
			// }),
			// new NodeRunner(),
			// new ProcessRunner("node"),
		],
	}],
	// reporter: "console",
};
