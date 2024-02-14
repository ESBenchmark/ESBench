import { defineConfig, DirectExecutor, rawReporter, textReporter, ViteBuilder } from "esbench/host";
import { chromium } from "playwright-core";
import WebextExecutor from "./executor/webextension.js";

const viteBuilder = new ViteBuilder();

export default defineConfig({
	reporters: [
		rawReporter("reports/result.json"),
		textReporter({ stdDev: true }),
	],
	diff: "reports/result-1.json",
	toolchains: [{
		include: ["./src/loop-*.js"],
		// builders: [
		// 	viteBuilder,
			// new RollupBuilder(),
		// ],
		executors: [
			// new NodeDebugExecutor(false),
			// new NodeDebugExecutor(true),
			DirectExecutor,
			// ne,
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
			// new ProcessExecutor("D:/qjs"),
		],
	},{
		include: ["./webext/*.js"],
		builders: [viteBuilder],
		executors: [new WebextExecutor(chromium)],
	}],
});
