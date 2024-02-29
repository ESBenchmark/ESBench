<template>
	<section>
		<LabeledSelect v-model='errorBarType' label='Error bar type'>
			<option :value='pointFactories.none'>None</option>
			<option :value='pointFactories.valueRange'>Value Range</option>
			<option :value='pointFactories.stdDev'>Standard Deviation</option>
			<option :value='pointFactories.stdErr'>Standard Error</option>
		</LabeledSelect>

		<canvas ref='canvasRef'/>
	</section>
</template>

<script setup lang="ts">
import { mean, standardDeviation } from "simple-statistics";
import { computed, onMounted, shallowRef, watch } from "vue";
import { BarWithErrorBarsChart } from "chartjs-chart-error-bars";
import { FlattedResult, Summary } from "esbench";
import LabeledSelect from "./LabeledSelect.vue";
import { UseDataFilterReturn } from "./useDataFilter.ts";

interface ChartSectionProps {
	summary: Summary;
	previous: Summary;
	filter: UseDataFilterReturn;
}

const props = defineProps<ChartSectionProps>();
const { getMetrics } = Summary;

const CHART_COLORS = [
	"rgba(54, 162, 235, .5)",
	"rgba(255, 99, 132, .5)",
	"rgba(255, 159, 64, .5)",
	"rgba(255, 205, 86, .5)",
	"rgba(75, 192, 192, .5)",
	"rgba(153, 102, 255, .5)",
	"rgba(201, 203, 207, .5)",
];

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

let chart: BarWithErrorBarsChart;

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
	ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.lineWidth = 20 / 10;

	drawDiagonalLine();
	drawDiagonalLine(halfSize, halfSize);
	ctx.stroke();

	const pattern = ctx.createPattern(canvas, "repeat")!;
	canvas.width = 40;
	canvas.height = 40;
	return pattern;
}

function drawDiagonalLine(offsetX = 0, offsetY = 0) {
	const halfSize = 20 / 2;
	const gap = 1;
	ctx.moveTo((halfSize - gap) - offsetX, (gap * -1) + offsetY);
	ctx.lineTo((20 + 1) - offsetX, (halfSize + 1) + offsetY);
	ctx.closePath();
}

const data = computed(() => {
	const { summary, previous, filter } = props;
	const { matches, xAxis } = filter;

	const labels = [...summary.vars.get(xAxis.value)!];
	const datasets = [];
	const scales: Record<string, any> = {};

	let i = 0;
	for (const [name, meta] of summary.meta) {
		const color = CHART_COLORS[(i++) % CHART_COLORS.length];

		scales.y = {
			title: { display: true, text: name },
		};

		if (meta.analysis && previous.meta.get(name)) {
			datasets.push({
				label: `${name} (prev)`,
				data: matches.value.map(r => {
					const d = previous.find(r);
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

</style>
