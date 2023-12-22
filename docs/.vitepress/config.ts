import { defineConfig } from "vitepress";

export default defineConfig({
	title: "ESBench",
	description: "A VitePress Site",
	vite: {
		// The site should be deployed to a platform that supports these headers.
		server: {
			headers: {
				"Cross-Origin-Opener-Policy": "same-origin",
				"Cross-Origin-Embedder-Policy": "require-corp",
			},
		},
	},
	themeConfig: {
		// https://vitepress.dev/reference/default-theme-config
		nav: [
			{ text: "Guide", link: "/guide/introduction" },
			{ text: "Playground", link: "/playground/index" },
		],

		sidebar: [
			{
				text: "Getting started",
				items: [
					{ text: "Introduction", link: "/guide/introduction" },
				],
			},
		],

		socialLinks: [
			{ icon: "github", link: "https://github.com/Kaciras/esbench" },
		],
	},
});
