<template>
	<div :class='$style.container'>
		<header>
			<h2>{{ name }}</h2>

			<LabeledSelect
				v-model='errorBarType'
				label='Error bar type'
			>
				<option :value='pointFactories.none'>None</option>
				<option :value='pointFactories.valueRange'>Value Range</option>
				<option :value='pointFactories.stdDev'>Standard Deviation</option>
				<option :value='pointFactories.stdErr'>Standard Error</option>
			</LabeledSelect>
		</header>

		<section :class='$style.main'>
			<canvas ref='canvasRef'/>

			<div v-if='summary.notes.length' :class='$style.notes'>
				<h2>Notes</h2>
				<p
					v-for='(note, i) of summary.notes.filter(isRelevant)'
					:key='i'
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
				v-for='([name, values], i) of summary.vars'
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
import { FlattedResult, ResolvedNote, Summary, type ToolchainResult } from "esbench";
import { mean, standardDeviation } from "simple-statistics";
import { BarWithErrorBarsChart } from "chartjs-chart-error-bars";
import { IconAlertTriangleFilled, IconInfoCircleFilled } from "@tabler/icons-vue";
import useDataFilter from "./useDataFilter.ts";
import LabeledSelect from "./LabeledSelect.vue";

interface SuiteReportProps {
	name: string;
	result: ToolchainResult[];
	prev?: ToolchainResult[];
}

const props = withDefaults(defineProps<SuiteReportProps>(), {
	prev: () => ([]),
});

const { getMetrics } = Summary;

const pointFactories = {
	none: (values: number[]) => ({ y: mean(values) }),

	stdDev(values: number[]) {
		const e = standardDeviation(values);
		const y = mean(values);
		return { y, yMin: y - e, yMax: y + e };
	},

	stdErr(values: number[]) {
		const e = standardDeviation(values) / Math.sqrt(values.length);
		const y = mean(values);
		return { y, yMin: y - e, yMax: y + e };
	},

	valueRange(values: number[]) {
		const y = mean(values);
		return { y, yMin: values.at(0), yMax: values.at(-1) };
	},
};

const errorBarType = shallowRef(pointFactories.valueRange);
const canvasRef = shallowRef();

const summary = computed(() => new Summary(props.result));
const previous = computed(() => new Summary(props.prev));

function isRelevant(note: ResolvedNote) {
	return !note.row || matches.value.includes(note.row);
}

let chart: BarWithErrorBarsChart;

const { variables, matches, xAxis } = useDataFilter(summary);

function getDataAndRange(name: string, result: FlattedResult) {
	const y = getMetrics(result)[name];
	return Array.isArray(y) ? errorBarType.value(y) : { y };
}

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d")!;

function createPattern(background: string) {
	canvas.width = 20;
	canvas.height = 20;

	ctx.fillStyle = background;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	const halfSize = 20 / 2;
	ctx.beginPath();
	setStrokeProps();
	drawDiagonalLine();
	drawDiagonalLine(halfSize, halfSize);
	ctx.stroke();

	const pattern = ctx.createPattern(canvas, "repeat")!;
	canvas.width = 40;
	canvas.height = 40;
	pattern.shapeType = "square";
	return pattern;
}

function setStrokeProps() {
	ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.lineWidth = 20 / 10;
}

function drawDiagonalLine(offsetX = 0, offsetY = 0) {
	const halfSize = 20 / 2;
	const gap = 1;
	ctx.moveTo((halfSize - gap) - offsetX, (gap * -1) + offsetY);
	ctx.lineTo((20 + 1) - offsetX, (halfSize + 1) + offsetY);
	ctx.closePath();
}

const CHART_COLORS = [
	"rgb(54, 162, 235, .5)",
	"rgb(255, 99, 132, .5)",
	"rgb(255, 159, 64, .5)",
	"rgb(255, 205, 86, .5)",
	"rgb(75, 192, 192, .5)",
	"rgb(153, 102, 255, .5)",
	"rgb(201, 203, 207, .5)",
];

const data = computed(() => {
	const labels = [...summary.value.vars.get(xAxis.value)!];
	const datasets = [];
	const scales: Record<string, any> = {};

	let i = 0;
	for (const [name, meta] of summary.value.meta) {
		const color = CHART_COLORS[(i++) % CHART_COLORS.length];

		scales.y = {
			title: { display: true, text: name },
		};

		if (meta.analysis && previous.value.meta.get(name)) {
			datasets.push({
				label: `${name} (prev)`,
				data: matches.value.map(r => {
					const d = previous.value.find(r);
					if (!d) {
						return { y: 0 };
					}
					return getDataAndRange(name, d);
				}),
				backgroundColor: createPattern(color),
			});
		}

		datasets.push({
			label: name,
			data: matches.value.map(r => getDataAndRange(name, r)),
			backgroundColor: color,
		});
	}

	return {
		data: { labels, datasets },
		options: {
			scales,
			responsive: true,
			plugins: {
				legend: { position: "top" },
			},
		},
	};
});

watch(data, newData => {
	chart.data = newData.data;
	chart.options = newData.options;
	chart.update("none");
});

onMounted(() => {
	chart = new BarWithErrorBarsChart(canvasRef.value, data.value);
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
