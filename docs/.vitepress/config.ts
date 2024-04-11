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
		['link', { rel: 'icon', href: '/logo.svg' }]
	],
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		logo: "/logo.svg",
		search: {
			provider: 'local'
		},
		nav: [
			{ text: "Guide", link: "/guide/introduction" },
			{ text: "Playground", link: "/playground" },
		],
		sidebar: [
			{
				text: "Getting started",
				items: [
					{ text: "Introduction", link: "/guide/introduction" },
					{ text: "Parameterization", link: "/guide/parameterization" },
					{ text: "Setup And Cleanup", link: "/guide/setup-cleanup" },
					{ text: "CLI", link: "/guide/cli" },
					{ text: "Toolchain", link: "/guide/toolchain" },
					{ text: "Baselines", link: "/guide/baselines" },
					{ text: "Reporters", link: "/guide/reporters" },
					{ text: "Validation", link: "/guide/validation" },
					{ text: "IDE Integration", link: "/guide/ide-integration" },
				],
			},
		],
		socialLinks: [
			{ icon: "github", link: "https://github.com/Kaciras/esbench" },
		],
		footer: {
			message: 'Released under the MIT License.',
			copyright: 'Copyright © 2024 ESBench contributors',
		},
	},
});
