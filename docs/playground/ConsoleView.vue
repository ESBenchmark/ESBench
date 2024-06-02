<template>
	<pre ref='consoleEl'>
Execute in iframe allow DOM operations, but the page may be unresponsive until it finishes.

Since WebWorker does not support import maps, you cannot import esbench in the suite.
	</pre>
</template>

<script lang="ts">
// IDEA Darcula theme
import { escapeHTML, unescapeHTML } from "@kaciras/utilities/browser";

const colors: Record<string, string> = {
	// no alias (gray & grey)
	black: "#000000",
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

/**
 * Detect string length with `CanvasRenderingContext2D.measureText`.
 *
 * Adding text to an element and then getting the width is also a solution,
 * but it requires deciding where to hide the element.
 */
const ctx = document.createElement("canvas").getContext("2d")!;
let dashWidth: number;

function setMeasurerFont(el: HTMLElement) {
	ctx.font = getComputedStyle(el).font;
	dashWidth = ctx.measureText("-").width;
}

function stringLength(s: string) {
	if (s.startsWith("<span ")) {
		s = s.slice(29, -7);
	}
	s = unescapeHTML(s);
	return Math.round(ctx.measureText(s).width / dashWidth);
}

const stainer = new Proxy<any>(stringLength, {
	apply(_, __, argArray) {
		return escapeHTML(argArray[0]);
	},
	get(_, p: string) {
		return (s: string) => `<span style="color: ${colors[p]}">${escapeHTML(s)}</span>`;
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
	const pre = consoleEl.value!;
	const color = colors[level];

	message += "\n";
	if (color) {
		const span = document.createElement("span");
		span.style.color = color;
		span.textContent = message;
		pre.append(span);
	} else {
		pre.insertAdjacentText("beforeend", message);
	}
	pre.scrollTop = pre.scrollHeight;
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
	const pre = consoleEl.value!;
	const { flexUnit } = options;
	setMeasurerFont(pre);

	const table = SummaryTable.from(result, undefined, options);
	const markdown = table.format({ stainer, flexUnit }).toMarkdown(stringLength);

	appendLog();
	pre.insertAdjacentHTML("beforeend", markdown);
	appendLog();

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
