import { defineConfig, DirectExecutor, rawReporter } from "@esbench/core";

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
		executors: [
			// new PlaywrightExecutor(firefox, {
			// 	headless: false,
				// executablePath: "D:/Program Files/Mozilla Firefox/firefox.exe",
			// }),
			// new NodeExecutor(),
			new DirectExecutor(),
			// new ProcessExecutor("node"),
		],
	}],
});
