<template>
	<main :class='$style.playground'>
		<section :class='$style.toolbar'>
			<button
				v-if='running'
				:class='$style.toolButton'
				type='button'
				@click='resolve2'
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
import { createTable, RunSuiteResult } from "esbench";
import defaultCode from "./template.js?raw";
import { SuiteReport } from "../../reporter-html/src/index.ts";
import { createSandbox } from "./sandbox.js";

// @ts-ignore
globalThis.MonacoEnvironment = {
	getWorker(_: any, label: string) {
		switch (label) {
			// case "typescript":
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
const running = shallowRef(false);
const logMessage = shallowRef("In order to be able to perform DOM operations, the benchmark will run in the main thread and the current page may be unresponsive until it finishes.");
const result = shallowRef<RunSuiteResult[]>();

let editor: monaco.editor.IStandaloneCodeEditor;

function createModule(code: string) {
	return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
}

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

const loaderTemplate = `\
import { connect } from "esbench";

const post = message => {
	parent.postMessage(message);
	return new Promise(r => setTimeout(r));
};

const doImport = file => import(file);

connect(post, doImport, ["__FILE__"])`;

let resolve2: any;

async function startBenchmark() {
	logMessage.value = "";
	running.value = true;
	result.value = undefined;

	const module = createModule(editor.getValue());
	const loader = createModule(loaderTemplate.replace("__FILE__", module));
	const iframe = createSandbox(loader);

	try {
		await new Promise<void>((resolve) => {
			resolve2 = resolve;
			window.addEventListener("message", ({ source, data }) => {
				if (source !== iframe.contentWindow) {
					return;
				}
				if (Array.isArray(data)) {
					resolve();
					result.value = data;
				} else if ("e" in data) {
					resolve();
					logMessage.value += data.e.stack;
				} else {
					logMessage.value += (data.log ?? "") + "\n";
					document.getElementById("console")!.scrollIntoView(false);
				}
			});
		});
	} finally {
		iframe.remove();
		URL.revokeObjectURL(module);
		URL.revokeObjectURL(loader);
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
