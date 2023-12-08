<template>
	<nav>
		<a
			v-for='[file, stages] of suites'
			:href='encodeURIComponent(file)'
		>
			{{file}}
		</a>
	</nav>

	<SuiteReport :class='$style.report' :name='name' :stages='stages'/>
</template>

<script setup lang="ts">
import type { ESBenchResult } from "@esbench/core/client";
import SuiteReport from "./SuiteReport.vue";

interface AppProps {
	result: ESBenchResult;
}

const props = defineProps<AppProps>();

const suites = Object.entries(props.result);

const [name, stages] = suites[0];
</script>

<style module>
nav {
    width: 320px;
}

.report {
    flex: 1;
}

a {
    padding: 10px;

    text-decoration: none;
    color: inherit;
}
</style>
