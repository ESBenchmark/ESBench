<template>
	<nav :class='$style.nav'>
		<h1>Suites</h1>
		<a
			v-for='name of names'
			:key='name'
			:class='[$style.link, selected == name && $style.active]'
			:href='"#" + encodeURIComponent(name)'
		>
			{{ name }}
		</a>
	</nav>

	<SuiteReport
		v-if='toolchains'
		:class='$style.report'
		:name='selected'
		:result='toolchains'
		:prev='previous'
	/>

	<main v-else>
		<h1 :class='$style.error'>Suite Not Found</h1>
	</main>
</template>

<script setup lang="ts">
import type { ESBenchResult } from "esbench";
import { computed, shallowRef } from "vue";
import SuiteReport from "./SuiteReport.vue";

interface AppProps {
	result: ESBenchResult;
	previous: ESBenchResult;
}

const props = defineProps<AppProps>();
const names = Object.keys(props.result);

function getSuiteName() {
	return decodeURIComponent(location.hash.slice(1));
}

const initName = getSuiteName() || names[0];

const selected = shallowRef(initName);

const toolchains = computed(() => props.result[selected.value]);
const previous = computed(() => props.previous[selected.value]);

window.addEventListener("hashchange", () => {
	selected.value = getSuiteName();
});
</script>

<style module>
:root {
	font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
	line-height: 1.5;
	color: #222;

	font-synthesis: none;
	text-rendering: optimizeLegibility;
	-webkit-text-size-adjust: 100%;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

* {
	box-sizing: border-box;
}

body {
	display: flex;
	margin: 0;
	height: 100vh;
}

.nav {
    width: 320px;
    background: #f6f6f7;
	overflow-y: scroll;

	& > h1 {
		padding: 0 20px;
	}
}

.report {
    flex: 1;
    margin-left: 20px;
}

.link {
    display: block;
	padding: 6px 20px;
    text-decoration: none;
    color: inherit;
	transition: background-color 0.15s;

	&:hover, :focus-visible {
		background: rgba(0,0,0,0.05);
	}
}

.active {
    color: #0077ff;
}

.error {
    color: #ef4848;
}
</style>
