import { readFileSync } from "fs";
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

const debugDataPlugin: Plugin = {
	name: "debug-data",
	transformIndexHtml(html) {
		const result = JSON.parse(readFileSync("../example/benchmark.json", "utf8"));
		return html.replace("<!--ESBench-Result-->", `<script>window.ESBenchResult=${result}</script>`);
	},
};

export default defineConfig(({ mode }) => ({
	plugins: [
		viteSingleFile(),
		svelte(),
		mode === "serve" && debugDataPlugin,
	],
	build: {
		outDir: mode === "plugin" ? "../core/html" : undefined,
	},
}));
