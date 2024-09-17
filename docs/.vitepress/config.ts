import { defineConfig, Plugin } from "vitepress";
import suiteInfoLoader from "./suite-loader.js";
import esbenchRuntime from "./esbench-runtime.js";

// The site should be deployed to a platform that supports these headers.
// https://github.com/vuejs/vitepress/issues/2195
const customHeaders: Plugin & Record<string, any> = {

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
	description: "Modern JavaScript Benchmarking Library",
	cleanUrls: true,
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
		outline: {
			level: [2, 3],
		},
		nav: [
			{ text: "Guide", link: "/guide/introduction" },
			{ text: "API", link: "/api/architecture" },
			{ text: "Playground", link: "/playground" },
		],
		sidebar: {
			guide: [{
				items: [
					{ text: "Introduction", link: "/guide/introduction" },
					{ text: "Getting Started", link: "/guide/getting-started" },
					{ text: "Suites", link: "/guide/suites" },
					{ text: "Parameterization", link: "/guide/parameterization" },
					{ text: "Comparison", link: "/guide/comparison" },
					{ text: "TypeScript", link: "/guide/typescript" },
					{ text: "Config", link: "/guide/config" },
					{ text: "Toolchains", link: "/guide/toolchains" },
					{ text: "CLI", link: "/guide/cli" },
					{ text: "Reporters", link: "/guide/reporters" },
					{ text: "Time Profiler", link: "/guide/time-profiler" },
					{ text: "Validation", link: "/guide/validation" },
					{ text: "Complexity", link: "/guide/complexity" },
					{ text: "IDE Integration", link: "/guide/ide-integration" },
					{ text: "FAQ", link: "/guide/faq" },
				],
			}],
			api: [{
				items: [
					{ text: "Architecture", link: "/api/architecture" },
					{ text: "Builder", link: "/api/builder" },
					{ text: "Executor", link: "/api/executor" },
					{ text: "Profiler", link: "/api/profiler" },
					{ text: "Runner API", link: "/api/runner-api" },
				],
			}],
		},
		socialLinks: [
			{ icon: "github", link: "https://github.com/ESBenchmark/ESBench" },
		],
		footer: {
			message: "Released under the MIT License.",
			copyright: "Copyright © 2024 ESBench contributors",
		},
	},
});
