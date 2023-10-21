<nav>
	{#each files as [file, scenes]}
		<a href={encodeURIComponent(file)}>{file}</a>
	{/each}
</nav>

<header>
Suite: {files[0][0]}
</header>

<main>
	<canvas bind:this={canvasRef}/>
	<select>
		<option>Mean</option>
		<option>Median</option>
	</select>
</main>

<section>

</section>

<script lang="ts">
import type { ESBenchResult } from "@esbench/core/src/client/collect.js";
import { BarController, BarElement, CategoryScale, Chart, Colors, Legend, LinearScale, Tooltip } from "chart.js";
import { onMount } from "svelte";

Chart.register(BarController, Tooltip, Colors, CategoryScale, LinearScale, BarElement, Legend);

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

const files = Object.entries(window.ESBenchResult as ESBenchResult);

const result = files[0][1];

let foldFn = mean;
let canvasRef: HTMLCanvasElement;

onMount(() => {
	new Chart(canvasRef, {
		type: "bar",
		data: {
			labels: result.map(r => r.name),
			datasets: [{
				label: "time",
				data: result.map(r => foldFn(r.metrics.time)),
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
nav {
    grid-area: nav;
}

main {
    grid-area: main;
}

header {
    grid-area: header;
    padding: 10px;
}

section {
    grid-area: params;
}

a {
    padding: 10px;
}
</style>
