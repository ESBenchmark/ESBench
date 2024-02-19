<template>
	<nav :class='$style.nav'>
		<h2>Suite Name</h2>
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
.nav {
    width: 320px;
    padding: 0 20px;
    background: #f6f6f7;
}

.report {
    flex: 1;
    margin-left: 20px;
}

.link {
    display: block;
    margin: 10px 0;
    text-decoration: none;
    color: inherit;
}

.active {
    color: #0077ff;
}

.error {
    color: #ef4848;
}
</style>
