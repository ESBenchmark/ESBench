import {
	defineConfig,
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

export default defineConfig({
	reporters: [
		textReporter(),
		rawReporter(),
	],
	toolchains: [{
		// The micromatch patterns ESBench used to glob suite files.
		include: ["./{self,node,custom-profiler}/*.[jt]s"],
	}, {
		include: ["./es/*.js"],

		/*
		 * To run suites with `browserExecutors`, uncomment the next line
		 * or add `--experimental-import-meta-resolve` to Node options.
		 */
		// builders: [viteBuilder],

		executors: [
			// Run suites directly in the context, it's also the default value.
			inProcessExecutor,

			// Measure performance of suites on browsers.
			// ...browserExecutors,

			// More JS runtimes, you need to install them.
			// new ProcessExecutor("bun"),
		],
	}, {
		include: ["./web/*.js"],
		builders: [viteBuilder],
		executors: browserExecutors,
	}, {
		include: ["./webext/*.js"],
		builders: [viteBuilder],
		executors: [new WebextExecutor(chromium)],
	}, {
		// Build the suite with different config, see their impact on performance.
		include: ["./misc/transpile.js"],
		builders: [
			{
				name: "modern",
				use: new ViteBuilder({ build: { target: "esnext" } }),
			},
			{
				name: "transpile",
				use: new ViteBuilder({ build: { target: "es6" } }),
			},
		],
	}],
});
