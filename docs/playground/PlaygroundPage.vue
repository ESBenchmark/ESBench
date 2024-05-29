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
		<ConsoleView ref='consoleView' :class='$style.console'/>

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
</script>

<script setup lang="ts">
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";
import * as monaco from "monaco-editor/esm/vs/editor/edcore.main.js";
import { nextTick, onMounted, onUnmounted, shallowReactive, shallowRef, toRaw } from "vue";
import { useData } from "vitepress";
import { transformBuffer } from "@kaciras/utilities/browser";
import { FormatOptions, messageResolver, RunSuiteResult, SummaryTableOptions } from "esbench";
import { IconChartBar, IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-vue";
import { useLocalStorage } from "@vueuse/core";
import suiteTemplate from "./template.js?raw";
import demos from "./demo-suites.ts";
import ReportView from "./ReportView.vue";
import ConsoleView from "./ConsoleView.vue";
import TableDropdown from "./TableDropdown.vue";
import { executeIFrame, executeWorker } from "./executor.ts";

export interface BenchmarkHistory {
	name: string;
	time: Date;
	result: RunSuiteResult[];
}

const editorEl = shallowRef<HTMLElement>();
const consoleView = shallowRef<InstanceType<typeof ConsoleView>>();
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

/**
 * Serialize the data as Base64 so that it can be appended to the URL,
 * and also compress it to keep the URL as short as possible.
 */
async function serialize(data: unknown) {
	let bytes = new TextEncoder().encode(JSON.stringify(data));
	bytes = await transformBuffer(bytes, new CompressionStream("deflate-raw"));
	return btoa(Array.from(bytes, b => String.fromCodePoint(b)).join(""));
}

async function deserialize(base64: string) {
	// @ts-expect-error TypeScript's declaration is incorrect.
	let bytes = Uint8Array.from(atob(base64), c => c.codePointAt(0));
	bytes = await transformBuffer(bytes, new DecompressionStream("deflate-raw"));
	return JSON.parse(new TextDecoder().decode(bytes));
}

async function share() {
	const url = new URL(location.href);
	url.hash = await serialize({
		code: editor.getModel()!.getValue(),
		exec: executor.value === executeWorker ? "worker" : "iframe",
		table: toRaw(tableOptions.value),
	});
	await navigator.clipboard.writeText(url.toString());
	window.alert("Link is copied to clipboard.");
}

let resolver: any;

function stopBenchmark() {
	resolver.reject(new Error("Benchmark Stopped"));
}

async function startBenchmark() {
	const webConsole = consoleView.value!;
	webConsole.clear();
	running.value = true;

	const { promise, dispatch } = resolver = messageResolver(webConsole.appendLog);
	const start = performance.now();
	webConsole.appendLog("Start Benchmark\n");

	try {
		await executor.value(editor.getValue(), dispatch, promise);
		const result = await promise;
		webConsole.printTable(result, tableOptions.value);
		results.push({ name: "playground-suite", result, time: new Date() });
	} catch (e) {
		webConsole.printError(e);
	}

	running.value = false;
	const t = (performance.now() - start) / 1000;
	webConsole.appendLog(`\nGlobal total time: ${t.toFixed(2)} seconds.`);
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
		const data = await deserialize(location.hash.slice(1));
		const { code, exec, table } = data;
		value = code;
		if (exec === "iframe") {
			executor.value = executeIFrame;
		}
		tableOptions.value = table;
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
