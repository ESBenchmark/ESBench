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
