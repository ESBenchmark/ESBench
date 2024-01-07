<template>
	<main :class='$style.playground'>
		<section :class='$style.toolbar'>
			<button
				:disabled='running'
				:class='$style.toolButton'
				type='button'
				@click='startBenchmark'
			>
				Run
			</button>
		</section>
		<section :class='$style.editor' ref='editorEl'/>
		<section :class='$style.output'>
			<pre :class='$style.console'>
				{{ logMessage }}
			</pre>
			<SuiteReport
				v-if='result'
				:name='result.name'
				:result='[result]'
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
import { onMounted, shallowRef } from "vue";
import { createTable, runSuite, RunSuiteResult } from "@esbench/core/client";
import defaultCode from "./template.js?raw";
import { SuiteReport } from "../../packages/reporter-html/src/index.ts";

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
const logMessage = shallowRef("");
const result = shallowRef<RunSuiteResult>();

let editor: monaco.editor.IStandaloneCodeEditor;

async function importCode(code: string) {
	const blob = new Blob([code], {
		type: "text/javascript",
	});
	const dataURL = URL.createObjectURL(blob);
	try {
		return await import(/* @vite-ignore */ dataURL);
	} finally {
		URL.revokeObjectURL(dataURL);
	}
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

async function startBenchmark() {
	const module = await importCode(editor.getValue());
	logMessage.value = "";
	running.value = true;
	result.value = await runSuite(module.default, {
		log: (_, message) => {
			if (message) {
				logMessage.value += message + "\n";
			} else {
				logMessage.value += "\n";
			}
			return new Promise(requestAnimationFrame);
		},
	});
	running.value = false;

	const {table}= createTable([result.value], {}, logChalk);
	console.table(table);
}

onMounted(() => {
	editor = monaco.editor.create(editorEl.value!, {
		value: props.initCode,
		language: "javascript",
		minimap: { enabled: false },
	});
	editor.focus();
});
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

:global(#sandbox) {
	display: none;
}
</style>
