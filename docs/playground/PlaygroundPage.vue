<template>
	<main :class='$style.playground'>
		<section :class='$style.toolbar'>
			Execute in:
			<label>
				<input
					v-model='executor'
					type='radio'
					name='executor'
					:value='executeWorker'
				>
				Worker
			</label>
			<label>
				<input
					v-model='executor'
					type='radio'
					name='executor'
					:value='executeIFrame'
				>
				iframe
			</label>

			<button
				v-if='running'
				:class='$style.toolButton'
				type='button'
				@click='stopBenchmark'
			>
				Stop
			</button>
			<button
				v-else
				:class='$style.toolButton'
				type='button'
				@click='startBenchmark'
			>
				Run
			</button>
		</section>
		<section :class='$style.editor' ref='editorEl'/>
		<section :class='$style.output'>
			<pre id='console'>
				{{ logMessage }}
			</pre>
			<SuiteReport
				v-if='result'
				:name='result[0].name'
				:result='result'
			/>
		</section>
		<section :class='$style.tabList'>

		</section>
	</main>
</template>

<script setup lang="ts">
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import * as monaco from "monaco-editor";
import { onMounted, onUnmounted, shallowRef } from "vue";
import { ClientMessage, createTable, RunSuiteResult } from "esbench";
import { IconPlayerPlayFilled, IconPlayerStopFilled } from "@tabler/icons-vue";
import defaultCode from "./template.js?raw";
import { SuiteReport } from "../../reporter-html/src/index.ts";
import { executeIFrame, executeWorker } from "./executor.ts";

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

interface PlaygroundProps {
	initCode: string;
}

const props = withDefaults(defineProps<PlaygroundProps>(), {
	initCode: defaultCode,
});

const editorEl = shallowRef<HTMLElement>();
const executor = shallowRef(executeWorker);
const running = shallowRef(false);
const logMessage = shallowRef("In order to be able to perform DOM operations, the benchmark will run in the main thread and the current page may be unresponsive until it finishes.");
const result = shallowRef<RunSuiteResult[]>();

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
	result.value = undefined;

	promise = new Promise<RunSuiteResult[]>((resolve1, reject1) => {
		resolve = resolve1;
		reject = reject1;
	});

	try {
		await executor.value(editor.getValue(), handleMessage, promise);
		result.value = await promise;
	} catch (e) {
		logMessage.value += `\n${e.message}\n`;
		logMessage.value += e.stack;
	}

	running.value = false;
	if (result.value) {
		const table = createTable(result.value, undefined, {}, logChalk);
		console.table(table);
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
	grid-template-areas: "toolbar tabs" "editor output";
	grid-template-rows: auto 1fr;
	grid-template-columns: 1fr 1fr;

	width: 100vw;
	height: 100vh;
}

.toolbar {
	grid-area: toolbar;
	display: flex;
	align-items: center;

	background: #eee;
}

.toolButton {
	padding: 4px 8px;

	&:where(:hover, :focus-visible) {
		background: rgba(0, 0, 0, 0.07);
	}

	&:where(:active) {
		background: rgba(0, 0, 0, 0.05);
	}

	&:disabled {
		opacity: 0.75;
		background: none;
	}
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

#console {
	margin: 0;
}

:global(#sandbox) {
	display: none;
}
</style>
