<template>
	<div :class='$style.container'>
		<header>
			<h2>{{ name }}</h2>

			<LabeledSelect
				v-model='errorBarType'
				label='Error bar type'
			>
				<option>None</option>
				<option>Value Range</option>
				<option>StdDev</option>
				<option>StdError</option>
			</LabeledSelect>
		</header>

		<section :class='$style.main'>
			<canvas ref='canvasRef'/>
		</section>

		<section :class='$style.params'>
			<h1>Parameters</h1>

		</section>
	</div>
</template>

<script setup lang="ts">
import { flatSummary, type StageResult } from "@esbench/core/client";
import { computed, onMounted, shallowRef, watch } from "vue";
import { BarWithErrorBarsChart } from "chartjs-chart-error-bars";
import LabeledSelect from "./LabeledSelect.vue";

interface SuiteReportProps {
	name: string;
	stages: StageResult[];
}

const props = defineProps<SuiteReportProps>();

const canvasRef = shallowRef();
const errorBarType = shallowRef();

function mean(values: number[]) {
	let sum = 0;
	for (const value of values) {
		sum += value;
	}
	return sum / values.length;
}

const data = computed(() => {
	const { list } = flatSummary(props.stages);
	const labels = list.map(r => r.name);
	const datasets = [{
		label: "time",
		data: list.map(r => ({
			y: mean(r.metrics.time),
			// yMin: 1000,
			// yMax: 1300,
		})),
	}];
	return { labels, datasets };
});

let chart;

onMounted(() => {
	chart = new BarWithErrorBarsChart(canvasRef.value, {
		data: data.value,
		options: {
			responsive: true,
			plugins: {
				legend: {
					position: "top",
				},
			},
		},
	});
});

watch(data, v => {
	chart.data = v;
	chart.update();
});
</script>

<style module>
.container {
    display: grid;
    grid-template-areas: "header params" "main params";
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr 400px;
    gap: 20px;
}

header {
    grid-area: header;
    padding: 10px;
}

.main {
    grid-area: main;
}

.params {
    grid-area: params;
}
</style>
