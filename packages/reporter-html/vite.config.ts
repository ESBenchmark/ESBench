import { readFileSync } from "fs";
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

const debugDataPlugin: Plugin = {
	name: "debug-data",
	transformIndexHtml(html) {
		const data = readFileSync("./dev-data.json", "utf8");
		return html.replace("<!--ESBench-Result-->", `<script>window.ESBenchResult=${data}</script>`);
	},
};

export default defineConfig(({ mode }) => ({
	plugins: [
		viteSingleFile(),
		svelte(),
		mode === "development" && debugDataPlugin,
	],
	build: {
		emptyOutDir: false,
		outDir: mode === "plugin" ? "../core/html" : undefined,
	},
}));
