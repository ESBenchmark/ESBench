import { defineConfig, DirectEngine, rawReporter } from "@esbench/core";

export default defineConfig({
	reporters: [
		rawReporter(),
	],
	stages: [{
		include: ["./src/*.js"],
		// builders: [
		// 	new ViteBuilder(),
		// 	new RollupBuilder(),
		// ],
		engines: [
			// new PlaywrightEngine(chromium, {
			// 	headless: false,
			// 	executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
			// }),
			// new NodeEngine(),
			new DirectEngine(),
			// new ProcessEngine("node"),
		],
	}],
});
