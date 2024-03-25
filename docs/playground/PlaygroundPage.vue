<template>
	<main :class='$style.playground'>
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

			<button
				:class='$style.toolButton'
				data-right
				type='button'
				@click='showChart=true'
			>
				<IconChartBar stroke='2'/>
				Chart Report
			</button>

			<a :class='$style.link' href='/'>Document</a>
			<a :class='$style.link' href='https://github.com/Kaciras/ESBench'>GitHub</a>
		</section>

		<section :class='$style.editor' ref='editorEl'/>

		<div :class='$style.dragger' @mousedown.prevent='handleDragStart'/>

		<pre ref='consoleEl' :class='$style.console'>
Execute in iframe allow DOM operations, but the current page may be unresponsive until it finishes.
		</pre>

		<ReportView v-model='showChart' :summaries='results'/>
	</main>
</template>

<script setup lang="ts">
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import * as monaco from "monaco-editor";
import { nextTick, onMounted, onUnmounted, shallowRef } from "vue";
import { messageResolver, RunSuiteResult } from "esbench";
import { IconChartBar, IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-vue";
import { useLocalStorage } from "@vueuse/core";
import suiteTemplate from "./template.js?raw";
import demos from "./demo-suites.ts";
import { executeIFrame, executeWorker } from "./executor.ts";
import ReportView from "./ReportView.vue";

window.MonacoEnvironment = {
	getWorker(_: any, label: string) {
		switch (label) {
			case "javascript":
				return new tsWorker();
		}
		return new editorWorker();
	},
};

export interface BenchmarkHistory {
	name: string;
	time: Date;
	result: RunSuiteResult[];
}

const editorEl = shallowRef<HTMLElement>();
const consoleEl = shallowRef<HTMLElement>();

const editorWidth = useLocalStorage("EW", "50%");
const executor = shallowRef(executeWorker);
const running = shallowRef(false);
const results = shallowRef<BenchmarkHistory[]>([]);
const showChart = shallowRef(false);

let editor: monaco.editor.IStandaloneCodeEditor;

// IDEA Darcula theme
const logColors: Record<string, string> = {
	black: "#000",
	blackBright: "#595959",
	blue: "#3993D4",
	blueBright: "#1FB0FF",
	cyan: "#00A3A3",
	cyanBright: "#00E5E5",
	gray: "#595959",
	grey: "#595959",
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

	// Log Levels
	error: "#F0524F",
	warning: "#E5BF00",
};

const logChalk = new Proxy<any>(logColors, {
	get(colors: typeof logColors, p: string) {
		return (s: string) => `<span style="color: ${colors[p]}">${s}</span>`;
	},
});

function appendLog(message = "", level = "info") {
	const el = consoleEl.value!;
	switch (level) {
		case "error":
			message = logChalk.red(message);
			break;
		case "warn":
			message = logChalk.yellowBright(message);
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
		results.value.push({ name: result[0].name, result, time: new Date() });
	} catch (e) {
		logError(e);
	} finally {
		running.value = false;
	}

	const t = (performance.now() - start) / 1000;
	appendLog(`\nGlobal total time: ${t.toFixed(2)} seconds.`);
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

onMounted(() => {
	const demoIndex = +new URLSearchParams(location.search).get("demo")!;

	if (demoIndex) {
		executor.value = demos[demoIndex].category === "web"
			? executeIFrame : executeWorker;
	}

	editor = monaco.editor.create(editorEl.value!, {
		language: "javascript",
		minimap: { enabled: false },
		value: demoIndex ? demos[demoIndex].code : suiteTemplate,
	});
});
</script>

<style module>
.playground {
	display: grid;
	grid-template-areas: "toolbar toolbar" "editor console";
	grid-template-rows: auto 1fr;
	grid-template-columns: v-bind(editorWidth) 1fr;

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
	box-shadow: 0 0 4px #aaa;
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

	&[data-right] {
		margin-left: auto;
	}

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

:global(#sandbox) {
	display: none;
}
</style>
