import {
	defineConfig,
	inProcessExecutor,
	ProcessExecutor,
	PlaywrightExecutor,
	rawReporter,
	textReporter,
	ViteBuilder,
	WebextExecutor,
} from "esbench/host";
import { chromium, firefox, webkit } from "playwright";

const viteBuilder = new ViteBuilder();

const browserExecutors = [
	new PlaywrightExecutor(firefox),
	new PlaywrightExecutor(webkit),
	new PlaywrightExecutor(chromium),
];

/*
 * For more configuration examples, see ./configs
 */
export default defineConfig({
	diff: "reports/benchmark.json",
	reporters: [
		rawReporter(),
		textReporter(),
	],
	toolchains: [{
		include: ["./self/*.[jt]s", "./node/*.js"],
	}, {
		include: ["./es/*.js"],

		// Build is required for browserExecutors.
		// builders: [viteBuilder],

		executors: [
			// Measure performance of suites on browsers.
			// ...browserExecutors,

			inProcessExecutor,

			// More JS runtimes, you need install them manually.
			// new ProcessExecutor("bun"),
			// new ProcessExecutor("deno run --allow-net"),
		],
	}, {
		include: ["./web/*.js"],
		builders: [viteBuilder],
		executors: browserExecutors,
	}, {
		include: ["./webext/*.js"],
		builders: [viteBuilder],
		executors: [new WebextExecutor(chromium)],
	}],
});
