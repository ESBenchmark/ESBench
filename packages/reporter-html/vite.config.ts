import { readFileSync } from "fs";
import { defineConfig, type Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import { interpolate } from "./lib/index.js";

const result = JSON.parse(readFileSync("../example/benchmark.json", "utf8"));

const debugDataPlugin: Plugin = {
	name: "debug-data",
	transformIndexHtml(html) {
		return interpolate(html, result);
	},
};

export default defineConfig(({ mode }) => ({
	plugins: [
		viteSingleFile(),
		svelte(),
		mode === "serve" && debugDataPlugin,
	],
}));
