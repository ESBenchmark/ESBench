import { defineConfig } from "vitepress";
import suiteInfoLoader from "./suite-loader.js";
import esbenchRuntime from "./esbench-runtime.js";

// The site should be deployed to a platform that supports custom headers.
// https://github.com/vuejs/vitepress/issues/2195
const customHeaders = {
	name: "context-isolation-headers",

	middleware(_, res, next) {
		res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
		res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
		return next();
	},

	configureServer(server) {
		server.middlewares.use(customHeaders.middleware);
	},
};

export default defineConfig({
	title: "ESBench",
	description: "Powerful JavaScript Benchmarking Tool",
	vite: {
		plugins: [customHeaders, suiteInfoLoader, esbenchRuntime],
	},
	head: [
		["link", { rel: "icon", href: "/logo.svg" }],
	],
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		logo: "/logo.svg",
		search: {
			provider: "local",
		},
		nav: [
			{ text: "Guide", link: "/guide/introduction" },
			{ text: "Playground", link: "/playground" },
		],
		sidebar: [
			{
				items: [
					{ text: "Introduction", link: "/guide/introduction" },
					{ text: "Suites", link: "/guide/suites" },
					{ text: "Parameterization", link: "/guide/parameterization" },
					{ text: "Baselines", link: "/guide/baselines" },
					{ text: "Config", link: "/guide/config" },
					{ text: "CLI", link: "/guide/cli" },
					{ text: "Toolchains", link: "/guide/toolchains" },
					// { text: "TypeScript", link: "/guide/typescript" },
					{ text: "Reporters", link: "/guide/reporters" },
					{ text: "Time Profiler", link: "/guide/time-profiler" },
					{ text: "Validation", link: "/guide/validation" },
					{ text: "IDE Integration", link: "/guide/ide-integration" },
				],
			},
			{
				text: "APIs",
				items: [
					{ text: "Runner API", link: "/api/runner" },
					{ text: "Custom Profilers", link: "/api/profiler" },
				],
			},
		],
		socialLinks: [
			{ icon: "github", link: "https://github.com/Kaciras/esbench" },
		],
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © 2024 ESBench contributors",
		},
	},
});
