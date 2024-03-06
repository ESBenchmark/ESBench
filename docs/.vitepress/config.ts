import { defineConfig } from "vitepress";

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
	description: "A VitePress Site",
	vite: {
		plugins: [customHeaders],
	},
	head: [
		['link', { rel: 'icon', href: '/favicon.svg' }]
	],
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
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
					{ text: "Toolchain", link: "/guide/toolchain" },
					{ text: "Baselines", link: "/guide/baselines" },
					{ text: "Reporters", link: "/guide/reporters" },
					{ text: "IDE Integration", link: "/guide/ide-integration" },
				],
			},
		],
		socialLinks: [
			{ icon: "github", link: "https://github.com/Kaciras/esbench" },
		],
	},
});
