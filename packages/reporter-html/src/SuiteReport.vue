<template>
	<div :class='$style.container'>
		<header>
			<h2>{{ name }}</h2>
		</header>

		<section :class='$style.main'>
			<canvas ref='canvasRef'/>

			<LabeledSelect
				v-model='errorBarType'
				label='Error bar type'
			>
				<option :value='none'>None</option>
				<option :value='valueRange'>Value Range</option>
				<option :value='stdDev'>Standard Deviation</option>
				<option :value='stdErr'>Standard Error</option>
			</LabeledSelect>
		</section>

		<section :class='$style.params'>
			<h1>Variables</h1>

			<LabeledSelect
				v-for='([name, values], i) of stf.vars'
				:key='i'
				v-model='dataFilter.variables.value[i]'
				:label='name'
				:disabled='name === dataFilter.xAxis.value'
				:class='[$style.variable, name === dataFilter.xAxis.value && $style.active]'
				@click.self='dataFilter.xAxis.value = name'
			>
				<option v-for='v of values' :key='v'>{{ v }}</option>
			</LabeledSelect>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import { type StageResult, SummaryTableFilter } from "@esbench/core/client";
import { mean, standardDeviation } from "simple-statistics";
import { BarWithErrorBarsChart } from "chartjs-chart-error-bars";
import useDataFilter from "./useDataFilter.ts";
import LabeledSelect from "./LabeledSelect.vue";

interface SuiteReportProps {
	name: string;
	stages: StageResult[];
}

const props = defineProps<SuiteReportProps>();
const stf = computed(() => new SummaryTableFilter(props.stages));

const canvasRef = shallowRef();
const errorBarType = shallowRef(valueRange);

let chart: BarWithErrorBarsChart;

const dataFilter = useDataFilter(stf);

function none(values: number[]) {
	return { y: mean(values) };
}

function stdDev(values: number[]) {
	const e = standardDeviation(values);
	const y = mean(values);
	return { y, yMin: y - e, yMax: y + e };
}

function stdErr(values: number[]) {
	const e = standardDeviation(values) / Math.sqrt(values.length);
	const y = mean(values);
	return { y, yMin: y - e, yMax: y + e };
}

function valueRange(values: number[]) {
	const y = mean(values);
	return { y, yMin: values.at(0), yMax: values.at(-1) };
}

const data = computed(() => {
	const matches = dataFilter.matches.value;

	const labels = [...stf.value.vars.get(dataFilter.xAxis.value)!];
	const datasets = [{
		label: "time",
		data: matches.map(r => errorBarType.value(stf.value.getMetrics(r).time)),
	}];
	return { labels, datasets } as any;
});

watch(data, newData => {
	chart.data = newData;
	chart.update("none");
});

onMounted(() => {
	chart = new BarWithErrorBarsChart(canvasRef.value, {
		data: data.value,
		options: {
			responsive: true,
			plugins: {
				legend: { position: "top" },
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
    padding: 20px;
}

.variable {
	cursor: pointer;
    padding: 8px;
	border-radius: 8px;

	&.active {
        cursor: default;
		background: #bee3ff;
	}
}
</style>
