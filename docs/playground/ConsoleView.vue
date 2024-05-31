<template>
	<pre ref='consoleEl'>
Execute in iframe allow DOM operations, but the page may be unresponsive until it finishes.

Since WebWorker does not support import maps, you cannot import esbench in the suite.
	</pre>
</template>

<script lang="ts">
// IDEA Darcula theme
const logColors: Record<string, string> = {
	// no alias (gray & grey)
	black: "#000",
	blackBright: "#595959",
	blue: "#3993D4",
	blueBright: "#1FB0FF",
	cyan: "#00A3A3",
	cyanBright: "#00E5E5",
	green: "#5C962C",
	greenBright: "#4FC414",
	magenta: "#A771BF",
	magentaBright: "#ED7EED",
	red: "#F0524F",
	redBright: "#FF4050",
	white: "#808080",
	whiteBright: "#fff",
	yellow: "#A68A0D",
	yellowBright: "#E5BF00",

	// Log level colors
	error: "#F0524F",
	warning: "#E5BF00",
};

const ctx = document.createElement("canvas").getContext("2d")!;
const colorTextMap = new Map<string, string>();
let dashWidth: number;

function resetColorMap(el: HTMLElement) {
	ctx.font = getComputedStyle(el).font;
	colorTextMap.clear();
	dashWidth = ctx.measureText("-").width;
}

function stringLength(s: string) {
	s = colorTextMap.get(s) ?? s;
	return Math.round(ctx.measureText(s).width / dashWidth);
}

const chalk = new Proxy<any>(logColors, {
	get(colors: typeof logColors, p: string) {
		return (s: string) => {
			const c = `<span style="color: ${colors[p]}">${s}</span>`;
			colorTextMap.set(c, s);
			return c;
		};
	},
});
</script>

<script setup lang="ts">
import { SummaryTable, FormatOptions, RunSuiteResult, SummaryTableOptions } from "esbench";
import { shallowRef } from "vue";

type PrintTableOptions = FormatOptions & SummaryTableOptions;

const consoleEl = shallowRef<HTMLElement>();

function clear() {
	consoleEl.value!.textContent = "";
}

function appendLog(message = "", level = "info") {
	const el = consoleEl.value!;
	switch (level) {
		case "error":
			message = chalk.red(message);
			break;
		case "warn":
			message = chalk.yellowBright(message);
			break;
	}
	el.insertAdjacentHTML("beforeend", message + "\n");
	el.scrollTop = el.scrollHeight;
}

function printError(e: Error) {
	appendLog(`\n${e.name}: ${e.message}`, "error");

	for (let c = e.cause as Error; c; c = c.cause as Error) {
		appendLog("Caused by:", "error");
		appendLog(`${c.name}: ${c.message}`, "error");
	}

	console.error(e);
	appendLog("\nFor stacktrace and more details, see console.", "error");
}

function printTable(result: RunSuiteResult[], options: PrintTableOptions) {
	const { flexUnit } = options;
	resetColorMap(consoleEl.value!);
	const table = SummaryTable.from(result, undefined, options);

	appendLog();
	appendLog(table.format({ chalk, flexUnit }).toMarkdown(stringLength));

	if (table.hints.length > 0) {
		appendLog("Hints:");
		for (const note of table.hints) appendLog(note);
	}

	if (table.warnings.length > 0) {
		appendLog("Warnings:");
		for (const note of table.warnings) appendLog(note);
	}
}

defineExpose({ clear, appendLog, printError, printTable });
</script>
