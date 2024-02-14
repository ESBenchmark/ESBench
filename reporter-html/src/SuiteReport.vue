<template>
	<div :class='$style.container'>
		<header>
			<h2>{{ name }}</h2>

			<LabeledSelect
				v-model='errorBarType'
				label='Error bar type'
			>
				<option :value='none'>None</option>
				<option :value='valueRange'>Value Range</option>
				<option :value='stdDev'>Standard Deviation</option>
				<option :value='stdErr'>Standard Error</option>
			</LabeledSelect>
		</header>

		<section :class='$style.main'>
			<canvas ref='canvasRef'/>

			<div v-if='stf.notes.length' :class="$style.notes">
				<h2>Notes</h2>

				<p
					v-for='note of stf.notes'
				>
					<IconAlertTriangleFilled
						v-if='note.type === "warn"'
						:class='$style.warn'
					/>
					<IconInfoCircleFilled
						v-else
						:class='$style.info'
					/>

					<template v-if='note.row'>
						{{ note.row[xAxis] }}:
					</template>
					{{ note.text }}
				</p>
			</div>
		</section>

		<section :class='$style.params'>
			<h1>Variables</h1>

			<LabeledSelect
				v-for='([name, values], i) of stf.vars'
				:key='i'
				v-model='variables[i]'
				:label='name'
				:disabled='name === xAxis'
				:class='[
					$style.variable,
					name === xAxis && $style.active
				]'
				@click.self='xAxis = name'
			>
				<option v-for='v of values' :key='v'>{{ v }}</option>
			</LabeledSelect>
		</section>
	</div>
</template>

<script setup lang="ts">
import { computed, onMounted, shallowRef, watch } from "vue";
import { MetricAnalysis, Summary, type ToolchainResult } from "esbench";
import { mean, standardDeviation } from "simple-statistics";
import { BarWithErrorBarsChart } from "chartjs-chart-error-bars";
import { IconAlertTriangleFilled, IconInfoCircleFilled } from "@tabler/icons-vue";
import useDataFilter from "./useDataFilter.ts";
import LabeledSelect from "./LabeledSelect.vue";

interface SuiteReportProps {
	name: string;
	result: ToolchainResult[];
}

const props = defineProps<SuiteReportProps>();

const { getMetrics } = Summary;

const errorBarType = shallowRef(valueRange);
const canvasRef = shallowRef();

const stf = computed(() => new Summary(props.result));

let chart: BarWithErrorBarsChart;

const { variables, matches, xAxis } = useDataFilter(stf);

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
	const labels = [...stf.value.vars.get(xAxis.value)!];
	const datasets = [];

	for (const [name, meta] of stf.value.meta) {
		if (meta.analysis === MetricAnalysis.Statistics) {
			datasets.push({
				label: name,
				data: matches.value.map(r => errorBarType.value(getMetrics(r)[name])),
			});
		} else if (meta.analysis === MetricAnalysis.Compare) {
			datasets.push({
				label: name,
				data: matches.value.map(r => getMetrics(r)[name]),
			});
		}
	}

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

.notes > p {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.info {
	color: #3498db;
}

.warn {
	color: #f1c40f;
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
