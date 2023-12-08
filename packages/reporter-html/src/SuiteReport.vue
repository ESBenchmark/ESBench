<template>
	<div :class='$style.container'>
		<header>
			Suite: {name}
		</header>

		<section :class='$style.main'>
			<canvas ref='canvasRef'/>
			<select>
				<option>Mean</option>
				<option>Median</option>
			</select>
		</section>

		<section :class='$style.params'>
			<h1>Parameters</h1>
		</section>
	</div>
</template>

<script setup lang="ts">
import { flatSummary, type StageResult } from "@esbench/core/client";
import { Chart } from "chart.js";
import { onMounted, shallowRef } from "vue";

interface SuiteReportProps {
	name: string;
	stages: StageResult[];
}

const props = defineProps<SuiteReportProps>();

const flatted = flatSummary(props.stages);
const canvasRef = shallowRef();

function mean(values: number[]) {
	let sum = 0;
	for (const value of values) {
		sum += value;
	}
	return sum / values.length;
}

function meaian(values: number[]) {
	values.sort();
	return values[Math.round(values.length / 2)];
}

onMounted(() => {
	new Chart(canvasRef.value, {
		type: "bar",
		data: {
			labels: flatted.list.map(r => r.name),
			datasets: [{
				label: "time",
				data: flatted.list.map(r => mean(r.metrics.time)),
			}],
		},
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
</script>

<style module>
.container {
    display: grid;
    grid-template-areas: "header params" "main params";
    grid-template-rows: auto 1fr;
    grid-template-columns: 1fr 400px;
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
