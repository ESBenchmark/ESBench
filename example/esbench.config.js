import {
	defineConfig,
	DirectExecutor,
	PlaywrightExecutor,
	rawReporter,
	textReporter,
	ViteBuilder,
	WebextExecutor,
} from "esbench/host";
import { chromium } from "playwright-core";

const viteBuilder = new ViteBuilder();

export default defineConfig({
	reporters: [
		rawReporter("reports/result.json"),
		textReporter({ stdDev: true }),
	],
	diff: "reports/result-1.json",
	toolchains: [{
		include: ["./es/*.js"],
		// builders: [
		// 	viteBuilder,
		// 	new RollupBuilder(),
		// ],
		executors: [
			// new PlaywrightExecutor(firefox),
			// new PlaywrightExecutor(chromium),
			// new PlaywrightExecutor(webkit),

			DirectExecutor,

			// new NodeExecutor(),
			// new ProcessExecutor("node"),
			// new ProcessExecutor("bun"),
			// new ProcessExecutor("deno run --allow-net"),
		],
	}, {
		include: ["./self/*", "./node/*"],
	}, {
		include: ["./web/*.js"],
		builders: [viteBuilder],
		executors: [new PlaywrightExecutor(chromium)],
	}, {
		include: ["./webext/*.js"],
		builders: [viteBuilder],
		executors: [new WebextExecutor(chromium)],
	}],
});
