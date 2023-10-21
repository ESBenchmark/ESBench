import { readFileSync } from "fs";
import { defineConfig, Plugin } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import { interpolate } from "./lib/index.js";

const result = JSON.parse(readFileSync("../example/perf.json", "utf8"));

const debugDataPlugin: Plugin = {
	name: "debug-data",
	transformIndexHtml(html) {
		return interpolate(html, result);
	},
};

export default defineConfig({
	plugins: [svelte(), debugDataPlugin, viteSingleFile()],
});
