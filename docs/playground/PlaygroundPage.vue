<template>
	<main :class='$style.playground'>
		<section :class='$style.toolbar'>
			<h1 :class='$style.h1'>ESBench Playground</h1>
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
				<IconChartBar/>
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
import { ClientMessage, RunSuiteResult } from "esbench";
import { IconChartBar, IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-vue";
import { useLocalStorage } from "@vueuse/core";
import defaultCode from "./template.js?raw";
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

monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);

export interface BenchmarkHistory {
	name: string;
	time: Date;
	result: RunSuiteResult[];
}

export interface PlaygroundProps {
	initCode?: string;
}

const props = withDefaults(defineProps<PlaygroundProps>(), {
	initCode: defaultCode,
});

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

let promise: Promise<RunSuiteResult[]>;
let resolve: (value: RunSuiteResult[]) => void;
let reject: (reason?: any) => void;

function stopBenchmark() {
	reject(new Error("Benchmark Stopped"));
}

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

function handleMessage(data: ClientMessage) {
	if (Array.isArray(data)) {
		resolve(data);
	} else if ("e" in data) {
		reject(data.e);
	} else {
		appendLog(data.log, data.level);
	}
}

async function startBenchmark() {
	consoleEl.value!.textContent = "Start Benchmark\n";
	running.value = true;

	promise = new Promise<RunSuiteResult[]>((resolve1, reject1) => {
		resolve = resolve1;
		reject = reject1;
	});

	try {
		await executor.value(editor.getValue(), handleMessage, promise);
		const result = await promise;
		results.value.push({
			name: result[0].name,
			result,
			time: new Date(),
		});
		appendLog("\nBenchmark Completed.");
	} catch (e) {
		appendLog();
		appendLog(e.message, "error");
		appendLog(e.stack, "error");
	} finally {
		running.value = false;
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

onMounted(() => {
	editor = monaco.editor.create(editorEl.value!, {
		value: props.initCode,
		language: "javascript",
		minimap: { enabled: false },
	});
	editor.focus();
});

onUnmounted(() => editor.dispose());
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
	font-size: 18px;
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
}

.start {
	composes: toolButton;
	background: #06af08;
}

.stop {
	composes: toolButton;
	background: #d01a1a;
}

.link {
	color: var(--vp-c-text-1);

	&:hover,&:focus-visible {
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
