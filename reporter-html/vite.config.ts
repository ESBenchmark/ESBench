import { readFileSync } from "fs";
import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import { viteSingleFile } from "vite-plugin-singlefile";

const debugDataPlugin: Plugin = {
	name: "debug-data",
	transformIndexHtml(html) {
		const data = readFileSync("./dev-data.json", "utf8");
		const prev = readFileSync("./dev-prev.json", "utf8");
		return html
			.replace("<!--ESBench-Result-->", `<script>window.Result=${data}</script>`)
			.replace("<!--ESBench-Previous-->", `<script>window.Previous=${prev}</script>`);
	},
};

export default defineConfig(({ mode }) => ({
	plugins: [
		viteSingleFile(),
		vue(),
		mode === "development" && debugDataPlugin,
	],
	build: {
		target: "esnext",
		emptyOutDir: false,
		outDir: mode === "plugin" ? "../core/html" : undefined,
	},
}));
