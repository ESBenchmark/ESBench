import { defineConfig, DirectExecutor, rawReporter, textReporter } from "@esbench/core";

export default defineConfig({
	reporters: [
		rawReporter("reports/result.json"),
		textReporter({ stdDev: true }),
	],
	diff: "reports/result-1.json",
	toolchains: [{
		include: ["./src/*.js"],
		// builders: [
		// 	new ViteBuilder(),
		// 	new RollupBuilder(),
		// ],
		executors: [
			new DirectExecutor(),
			// new NodeExecutor(),
			//
			// new PlaywrightExecutor(firefox),
			// new PlaywrightExecutor(chromium),
			// new PlaywrightExecutor(webkit),
			//
			// new PlaywrightExecutor(chromium, { headless: false }),
			//
			// new ProcessExecutor("node"),
			// new ProcessExecutor("bun"),
			// new ProcessExecutor("deno run --allow-net"),
			// new ProcessExecutor("D:\\qjs"),
		],
	}],
});
