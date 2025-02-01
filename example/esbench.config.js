// noinspection ES6UnusedImports

import {
	defineConfig,
	inProcessExecutor,
	NodeExecutor,
	PlaywrightExecutor,
	ProcessExecutor,
	rawReporter,
	textReporter,
	ViteBuilder,
	WebextExecutor,
	WebRemoteExecutor,
} from "esbench/host";
import { chromium, firefox, webkit } from "playwright";

const viteBuilder = new ViteBuilder();

const playwrightBrowsers = [
	new PlaywrightExecutor(firefox),
	new PlaywrightExecutor(webkit),
	new PlaywrightExecutor(chromium),
];

const browserExecutor = new WebRemoteExecutor();

export default defineConfig({
	reporters: [
		textReporter(),
		rawReporter(),
	],
	toolchains: [{
		// The micromatch patterns ESBench used to glob suite files.
		include: ["./{self,node,profilers}/*.[jt]s"],
	}, {
		include: ["./es/*.[jt]s"],

		/*
		 * To run suites with `playwrightBrowsers`, uncomment the next line
		 * or add `--experimental-import-meta-resolve` to Node options.
		 */
		// builders: [viteBuilder],

		executors: [
			// Run suites directly in the context, it's also the default value.
			inProcessExecutor,

			// Run suites on your browser.
			// new WebRemoteExecutor({ open: {} }),

			// Use playwright's browsers.
			// ...playwrightBrowsers,

			// Run in Node with TurboFan compiler disabled.
			// new NodeExecutor({ execArgv: ["--no-opt"] }),

			// More JS runtimes, you need to install them.
			// new ProcessExecutor("bun"),
		],
	}, {
		include: ["./web/*.js"],
		builders: [viteBuilder],
		executors: [browserExecutor],
	}, {
		include: ["./webext/*.js"],
		builders: [viteBuilder],
		executors: [new WebextExecutor(chromium)],
	}, {
		// Node 22.6.0 drops the support of HTTP import.
		include: ["./misc/import-http-module.js"],
		executors: [browserExecutor],
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
