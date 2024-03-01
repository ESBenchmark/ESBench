<template>
	<main :class='$style.playground'>
		<section :class='$style.toolbar'>
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
				type='button'
				@click='showChart=true'
			>
				<IconChartBar/>
				Chart Report
			</button>

			|

			<a href='/guide'>Guide</a>
			<a href='https://github.com/Kaciras/ESBench'>GitHub</a>
		</section>
		<section :class='$style.editor' ref='editorEl'/>
		<section :class='$style.output'>
			<pre id='console'>{{ logMessage }}</pre>
		</section>

		<ReportView v-model='showChart' :summaries='results'/>
	</main>
</template>

<script setup lang="ts">
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import * as monaco from "monaco-editor";
import { onMounted, onUnmounted, shallowRef, watchEffect } from "vue";
import { ClientMessage, RunSuiteResult } from "esbench";
import { IconChartBar, IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-vue";
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
const executor = shallowRef(executeWorker);
const running = shallowRef(false);
const logMessage = shallowRef();
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
};

const logChalk = new Proxy<any>(logColors, {
	get(colors: typeof logColors, p: string) {
		return (s: string) => `<span style="color: ${colors[p]}">${s}</span>`;
	},
});

let promise: Promise<RunSuiteResult[]>;
let resolve: (value: RunSuiteResult[]) => void;
let reject: (reason?: any) => void;

watchEffect(() => {
	logMessage.value = executor.value === executeWorker
		? ""
		: "Run in iframe allow DOM operations, but the current page may be unresponsive until it finishes.";
});

function stopBenchmark() {
	reject(new Error("Benchmark Stopped"));
}

function handleMessage(data: ClientMessage) {
	if (Array.isArray(data)) {
		resolve(data);
	} else if ("e" in data) {
		reject(data.e);
	} else {
		logMessage.value += (data.log ?? "") + "\n";
		document.getElementById("console")!.scrollIntoView(false);
	}
}

async function startBenchmark() {
	logMessage.value = "";
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
	} catch (e) {
		logMessage.value += `\n${e.message}\n`;
		return logMessage.value += e.stack;
	} finally {
		running.value = false;
	}
}

onMounted(() => {
	editor = monaco.editor.create(editorEl.value!, {
		value: props.initCode,
		language: "javascript",
		minimap: { enabled: false },
	});
	editor.focus();
	document.title = "ESBench Playground";
});

onUnmounted(() => editor.dispose());
</script>

<style module>
.playground {
	display: grid;
	grid-template-areas: "toolbar toolbar" "editor output";
	grid-template-rows: auto 1fr;
	grid-template-columns: 1fr 1fr;

	width: 100vw;
	height: 100vh;
}

.toolbar {
	grid-area: toolbar;
	display: flex;
	gap: 10px;
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

.tabList {
	grid-area: tabs;
	background: #eee;
}

.tab {

}

.editor {
	grid-area: editor;
}

.output {
	grid-area: output;
	padding: 1em;
	font-size: 0.875em;
	overflow: scroll;
	color: whitesmoke;
	background: #2b2b2b;
}

:global(#console) {
	margin: 0;
	white-space: pre-wrap;
}

:global(#sandbox) {
	display: none;
}
</style>
