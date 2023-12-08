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
			<h1>Variables</h1>

			<LabeledSelect
				v-for='(def, i) of filterDefs'
				:key='i'
				v-model='filters[i]'
				:label='def.name'
			>
				<option
					v-for='value of def.values'
					:key='value'
				>
					{{ value }}
				</option>
			</LabeledSelect>
		</section>
	</div>
</template>

<script setup lang="ts">
import { flatSummary, FlattedResult, type StageResult } from "@esbench/core/client";
import { computed, onMounted, reactive, shallowRef, watch } from "vue";
import { mean } from "simple-statistics";
import { BarWithErrorBarsChart } from "chartjs-chart-error-bars";
import LabeledSelect from "./LabeledSelect.vue";

interface SuiteReportProps {
	name: string;
	stages: StageResult[];
}

const props = defineProps<SuiteReportProps>();
const flatted = computed(() => flatSummary(props.stages));

const canvasRef = shallowRef();
const errorBarType = shallowRef();

let chart: BarWithErrorBarsChart;

interface FilterDef {
	type: (result: FlattedResult, name: string, value: any) => boolean;
	name: string;
	values: string[];
}

function topLevel(result: FlattedResult, name: string, value: any) {
	return (result as any)[name] === value;
}

function paramFilter(result: FlattedResult, name: string, value: any) {
	return result.params[name] === value;
}

const filterDefs = computed(() => {
	const defs: FilterDef[] = [];
	const { builders, engines, params } = flatted.value;

	if (builders.size > 0) {
		defs.push({ type: topLevel, name: "builder", values: [...builders] });
	}
	if (engines.size > 0) {
		defs.push({ type: topLevel, name: "engine", values: [...engines] });
	}

	for (const [name, values] of Object.entries(params)) {
		defs.push({ type: paramFilter, name, values: [...values] });
	}

	return defs;
});

const filters = reactive<any[]>([]);

function resetFilterData() {
	filters.length = 0;
	for (const def of filterDefs.value) {
		filters.push(def.values[0]);
	}
}

watch(flatted, resetFilterData, { flush: "pre" });

const data = computed(() => {
	const { list } = flatted.value;

	const matches = list.filter(v => {
		for (let i = 0; i < filters.length; i++) {
			const { type, name } = filterDefs.value[i];
			if (!type(v, name, filters[i])) {
				return false;
			}
		}
		return true;
	});

	const labels = matches.map(r => r.name);
	const datasets = [{
		label: "time",
		data: matches.map(r => ({
			y: mean(r.metrics.time),
			// yMin: NaN,
			// yMax: NaN,
		})),
	}];
	return { labels, datasets } as any;
});

watch(data, newData => {
	chart.data = newData;
	chart.update();
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
</style>
