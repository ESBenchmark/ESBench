import {
	defineConfig,
	htmlReporter,
	inProcessExecutor,
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
	reporters: [
		textReporter(),
		rawReporter(),
		htmlReporter(),
	],
	toolchains: [{
		include: [
			"./custom-profiler/*.[jt]s",
			"./self/*.[jt]s",
			"./node/*.[jt]s",
		],
	}, {
		include: ["./es/*.js"],

		// Build is required for browserExecutors.
		// builders: [viteBuilder],

		executors: [
			// Measure performance of suites on browsers.
			// ...browserExecutors,

			inProcessExecutor,

			// More JS runtimes, you need install them manually.
			// TODO: https://github.com/oven-sh/bun/issues/9963
			// new ProcessExecutor("bun"),

			// TODO: https://github.com/denoland/deno/issues/18192
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
