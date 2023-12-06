<div {...$$restProps} class={mergedClass}>
	<header>
		Suite: {name}
	</header>

	<section class="main">
		<canvas bind:this={canvasRef}/>
		<select>
			<option>Mean</option>
			<option>Median</option>
		</select>
	</section>

	<section class="params">
		<h1>Parameters</h1>
	</section>
</div>

<script lang="ts">
import { flatSummary, type StageResult } from "@esbench/core/client";
import { onMount } from "svelte";
import { Chart } from "chart.js";

export let name: string;
export let stages: StageResult[];

const flatted = flatSummary(stages);

let canvasRef: HTMLCanvasElement;

$: mergedClass = `container ${$$restProps.class}`

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

onMount(() => {
	new Chart(canvasRef, {
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

<style>
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
