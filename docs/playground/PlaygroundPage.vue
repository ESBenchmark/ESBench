<template>
	<main :class='$style.playground' :style='{ "--ew": editorWidth }'>
		<section :class='$style.toolbar'>
			<h1 :class='$style.h1'>
				<img alt='logo' src='/logo.svg'>
				ESBench Playground
			</h1>
			|
			<div>
				Execute in:
				<label>
					<input
						v-model='executor'
						type='radio'
						name='executor'
						:disabled='running'
						:value='executeWorker'
					>
					Worker
				</label>
				<label>
					<input
						v-model='executor'
						type='radio'
						name='executor'
						:disabled='running'
						:value='executeIFrame'
					>
					iframe
				</label>
			</div>

			<button
				v-if='running'
				:class='$style.stop'
				type='button'
				@click='stopBenchmark'
			>
				<IconPlayerStopFilled/>
				Stop
			</button>
			<button
				v-else
				:class='$style.start'
				type='button'
				@click='startBenchmark'
			>
				<IconPlayerPlayFilled/>
				Run
			</button>

			<TableDropdown :class='$style.right' v-model='tableOptions'/>
			<button
				:class='$style.toolButton'
				type='button'
				@click='showChart=true'
			>
				<IconChartBar stroke='2'/>
				Chart Report
			</button>

			<button
				type='button'
				@click='share'
			>
				Share
			</button>
			<a :class='$style.link' href='/'>Document</a>
			<a :class='$style.link' href='https://github.com/Kaciras/ESBench'>GitHub</a>
		</section>

		<section :class='$style.editor' ref='editorEl'/>

		<div :class='$style.dragger' @mousedown.prevent='handleDragStart'/>

		<pre ref='consoleEl' :class='$style.console'>
Execute in iframe allow DOM operations, but the page may be unresponsive until it finishes.

Since WebWorker does not support import maps, you cannot import esbench in the suite.
		</pre>

		<ReportView v-model='showChart' :summaries='results'/>
	</main>
</template>

<script lang="ts">
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

window.MonacoEnvironment = {
	getWorker(_: any, label: string) {
		switch (label) {
			case "javascript":
				return new tsWorker();
		}
		return new editorWorker();
	},
};

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

const webChalk = new Proxy<any>(logColors, {
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
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main.js";
import { nextTick, onMounted, onUnmounted, shallowReactive, shallowRef } from "vue";
import { useData } from "vitepress";
import { transformBuffer } from "@kaciras/utilities/browser";
import { buildSummaryTable, FormatOptions, messageResolver, RunSuiteResult, SummaryTableOptions } from "esbench";
import { IconChartBar, IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-vue";
import { useLocalStorage } from "@vueuse/core";
import suiteTemplate from "./template.js?raw";
import demos from "./demo-suites.ts";
import ReportView from "./ReportView.vue";
import TableDropdown from "./TableDropdown.vue";
import { executeIFrame, executeWorker } from "./executor.ts";

export interface BenchmarkHistory {
	name: string;
	time: Date;
	result: RunSuiteResult[];
}

const editorEl = shallowRef<HTMLElement>();
const consoleEl = shallowRef<HTMLElement>();
const vpData = useData();

const editorWidth = useLocalStorage("EW", "50%");
const tableOptions = useLocalStorage<SummaryTableOptions & FormatOptions>("TableOptions", {
	flexUnit: false,
	stdDev: true,
	outliers: "all",
	percentiles: [],
	ratioStyle: "percentage",
});
const executor = shallowRef(executeWorker);
const running = shallowRef(false);
const showChart = shallowRef(false);
const results = shallowReactive<BenchmarkHistory[]>([]);

let editor: monaco.editor.IStandaloneCodeEditor;

async function share() {
	const code = editor.getModel()!.getValue();
	const url = new URL(location.href);

	let bytes = new TextEncoder().encode(code);
	bytes = await transformBuffer(bytes, new CompressionStream("deflate-raw"));
	const binString = Array.from(bytes, b => String.fromCodePoint(b));
	url.hash = btoa(binString.join(""));

	if (executor.value === executeWorker) {
		url.search = "exec=worker";
	} else {
		url.search = "exec=iframe";
	}
	await navigator.clipboard.writeText(url.toString());
	window.alert("Link is copied to clipboard.");
}

function appendLog(message = "", level = "info") {
	const el = consoleEl.value!;
	switch (level) {
		case "error":
			message = webChalk.red(message);
			break;
		case "warn":
			message = webChalk.yellowBright(message);
			break;
	}
	el.insertAdjacentHTML("beforeend", message + "\n");
	el.scrollTop = el.scrollHeight;
}

function logError(e: Error) {
	appendLog(`\n${e.name}: ${e.message}`, "error");

	for (let c = e.cause as Error; c; c = c.cause as Error) {
		appendLog("Caused by:", "error");
		appendLog(`${c.name}: ${c.message}`, "error");
	}

	console.error(e);
	appendLog("\nFor stacktrace and more details, see console.", "error");
}

let resolver: any;

function stopBenchmark() {
	resolver.reject(new Error("Benchmark Stopped"));
}

async function startBenchmark() {
	consoleEl.value!.textContent = "Start Benchmark\n";
	running.value = true;
	const start = performance.now();

	const { promise, dispatch } = resolver = messageResolver(appendLog);

	try {
		await executor.value(editor.getValue(), dispatch, promise);
		const result = await promise;
		printTable(result);
		results.push({ name: "playground-suite", result, time: new Date() });
	} catch (e) {
		logError(e);
	}

	running.value = false;
	const t = (performance.now() - start) / 1000;
	appendLog(`\nGlobal total time: ${t.toFixed(2)} seconds.`);
}

function printTable(result: RunSuiteResult[]) {
	resetColorMap(consoleEl.value!);
	const table = buildSummaryTable(result, undefined, tableOptions.value, webChalk);

	appendLog();
	appendLog(table.format(tableOptions.value).toMarkdown(stringLength));

	if (table.hints.length > 0) {
		appendLog("Hints:");
		for (const note of table.hints) appendLog(note);
	}

	if (table.warnings.length > 0) {
		appendLog("Warnings:");
		for (const note of table.warnings) appendLog(note);
	}
}

function handleDragEnd() {
	document.removeEventListener("mouseup", handleDragEnd);
	document.removeEventListener("mousemove", handleMouseMove);
}

function handleDragStart() {
	document.addEventListener("mouseup", handleDragEnd);
	document.addEventListener("mousemove", handleMouseMove);
}

function handleMouseMove(event: MouseEvent) {
	const p = event.pageX / window.innerWidth * 100;
	if (p > 20 && p < 80) {
		editorWidth.value = p + "%";
		nextTick(() => editor.layout());
	}
}

onUnmounted(() => editor.dispose());

onMounted(async () => {
	const params = new URLSearchParams(location.search);
	let value = suiteTemplate;

	const demo = params.get("demo");
	if (demo) {
		const { code, category } = demos[parseInt(demo)];
		value = code;
		executor.value = category === "web"
			? executeIFrame : executeWorker;
	} else if (location.hash) {
		const b64 = atob(location.hash.slice(1));
		let bytes = Uint8Array.from(b64, c => c.codePointAt(0));
		bytes = await transformBuffer(bytes, new DecompressionStream("deflate-raw"));
		value = new TextDecoder().decode(bytes);
	}

	if (params.get("exec") === "iframe") {
		executor.value = executeIFrame;
	}

	editor = monaco.editor.create(editorEl.value!, {
		value,
		language: "javascript",
		scrollbar: { useShadows: false },
		minimap: { enabled: false },
		theme: vpData.isDark.value ? "vs-dark" : "vs",
	});
});
</script>

<style module>
.playground {
	display: grid;
	grid-template-areas: "toolbar toolbar" "editor console";
	grid-template-rows: auto 1fr;
	/* noinspection CssUnresolvedCustomProperty */
	grid-template-columns: var(--ew) 1fr;

	width: 100vw;
	height: 100vh;
}

.h1 {
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 18px;

	& > img {
		display: inline-block;
		width: 28px;
		height: 28px;
	}
}

.toolbar {
	grid-area: toolbar;
	display: flex;
	gap: 15px;
	align-items: center;
	padding: 0 10px;

	z-index: 9;
	border-bottom: solid 1px var(--vp-c-gutter);
}

.right {
	margin-left: auto;
}

.toolButton {
	display: inline-flex;
	gap: 5px;

	margin: 6px 0;
	padding: 5px 8px;
	border-radius: 4px;

	color: white;
	background: #0f4a85;
	transition: .15s;

	&:where(:hover, :focus-visible) {
		filter: brightness(1.1);
	}

	&:where(:active) {
		filter: brightness(0.95);
	}

	& > svg {
		width: 24px;
		height: 24px;
	}
}

.start {
	composes: toolButton;
	background: #07b00a;
}

.stop {
	composes: toolButton;
	background: #d01a1a;
}

.link {
	color: var(--vp-c-text-1);

	&:hover, &:focus-visible {
		color: var(--vp-c-brand-1);
	}
}

.editor {
	grid-area: editor;
}

.dragger {
	position: absolute;
	z-index: 3;
	top: 0;
	bottom: 0;
	left: calc(v-bind(editorWidth) - 4px);
	width: 8px;
	cursor: ew-resize;
}

.console {
	grid-area: console;
	margin: 0;
	padding: 1em;
	font-size: 0.875em;
	overflow: scroll;
	color: whitesmoke;
	background: #2b2b2b;
	white-space: pre-wrap;
}
</style>
