import { defineConfig, DirectExecutor, rawReporter, textReporter } from "@esbench/core";

export default defineConfig({
	reporters: [
		rawReporter(),
		textReporter({ stdDev: true }),
	],
	stages: [{
		include: ["./src/*.js"],
		// builders: [
		// 	new ViteBuilder(),
		// 	new RollupBuilder(),
		// ],
		executors: [
			// new PlaywrightExecutor(firefox),
			// new PlaywrightExecutor(chromium, {
			// 	headless: false,
			// }),
			// new PlaywrightExecutor(webkit),
			new DirectExecutor(),
			// new NodeExecutor(),
			// new ProcessExecutor("node"),
		],
	}],
});
