<template>
	<!-- Chart.js uses parent container to update display sizes -->
	<section>
		<canvas ref='canvasRef'/>
	</section>
</template>

<script lang="ts">
import { BarController, BarElement, CategoryScale, Chart, Legend, LinearScale, Tooltip } from "chart.js";
import { BarWithErrorBarsController } from "chartjs-chart-error-bars";

const CHART_COLORS = [
	"rgba(54, 162, 235, .5)",
	"rgba(255, 99, 132, .5)",
	"rgba(255, 159, 64, .5)",
	"rgba(255, 205, 86, .5)",
	"rgba(75, 192, 192, .5)",
	"rgba(153, 102, 255, .5)",
	"rgba(201, 203, 207, .5)",
];

Chart.register(BarWithErrorBarsController, BarController, Tooltip, CategoryScale, LinearScale, BarElement, Legend);
</script>

<script setup lang="ts">
import { mean } from "simple-statistics";
import { computed, onMounted, shallowRef, watch } from "vue";
import { BarWithErrorBarsChart, IErrorBarXYDataPoint } from "chartjs-chart-error-bars";
import { FlattedResult, MetricMeta, parseFormat, Summary } from "esbench";
import { TooltipItem } from "chart.js";
import { UseDataFilterReturn } from "./useDataFilter.ts";
import { diagonalPattern } from "./utils.ts";

interface ChartDataPoint {
	y: number;
	yMin?: number;
	yMax?: number;
}

interface ChartSectionProps {
	summary: Summary;
	previous: Summary;
	filter: UseDataFilterReturn;
}

const props = defineProps<ChartSectionProps>();

const canvasRef = shallowRef();

let chart: BarWithErrorBarsChart;

function getDataPoint(name: string, result?: FlattedResult) {
	if (!result) {
		return { y: 0 };
	}
	const value = Summary.getMetrics(result)[name];
	switch (typeof value) {
		case "undefined":
		case "string":
			return { y: 0 };
		case "number":
			return { y: value };
	}
	return {
		y: mean(value),
		yMin: Math.min(...value),
		yMax: Math.max(...value),
	};
}

function scale(meta: MetricMeta, points: ChartDataPoint[]) {
	if (!meta.format) {
		return { unit: "", format: String };
	}
	const yValues = points.map(p => p.y);
	const { formatter, rawUnit, suffix } = parseFormat(meta.format);
	const { scale, unit, sep } = formatter.homogeneous(yValues, rawUnit);

	for (const point of points) {
		point.y *= scale;
		if (point.yMin) {
			point.yMin *= scale;
		}
		if (point.yMax) {
			point.yMax *= scale;
		}
	}
	return { unit: unit + suffix, sep };
}

const chartConfig = computed(() => {
	const { summary, previous, filter: { matches, xAxis } } = props;

	const labels = [...summary.vars.get(xAxis.value)!];
	const datasets = [];
	const scales: Record<string, any> = {};

	let i = 0;
	for (const [name, meta] of summary.meta) {
		const color = CHART_COLORS[(i++) % CHART_COLORS.length];
		const yAxisID = `y-${name}`;

		const cv = matches.value.map(v => getDataPoint(name, v));
		let pv: typeof cv = [];

		if (meta.analysis && previous.meta.get(name)) {
			pv = matches.value.map(v => getDataPoint(name, v && previous.find(v)));
		}

		const { unit, sep } = scale(meta, [...cv, ...pv].filter(Boolean));

		if (pv.length !== 0) {
			datasets.push({
				label: `${name}-prev`,
				yAxisID,
				suffix: sep + unit,
				data: pv,
				backgroundColor: diagonalPattern(color),
			});
		}

		datasets.push({
			label: name,
			yAxisID,
			suffix: sep + unit,
			data: cv,
			backgroundColor: color,
		});

		scales[yAxisID] = {
			title: { display: true, text: `${name} (${unit})` },
		};
	}

	return { data: { labels, datasets }, scales };
});

function customTooltip(item: TooltipItem<"barWithErrorBars">) {
	const { label, suffix, data } = item.dataset as any;
	const point = data[item.dataIndex] as IErrorBarXYDataPoint;

	if (!point) {
		return console.log("No Point");
	}

	const { y, yMin, yMax } = point;
	const base = `${label}: ${y.toFixed(2)}${suffix}`;
	if (typeof yMin !== "number" || typeof yMax !== "number") {
		return base;
	}
	return `${base} (${yMin.toFixed(2)} ~ ${yMax.toFixed(2)})`;
}

watch(chartConfig, ({ data, scales }) => {
	chart.data = data as any;
	chart.options.scales = scales;
	chart.update();
});

onMounted(() => chart = new BarWithErrorBarsChart(canvasRef.value, {
	data: chartConfig.value.data as any,
	options: {
		animation: false,
		scales: chartConfig.value.scales,
		responsive: true,
		plugins: {
			legend: { position: "top" },
			tooltip: {
				callbacks: { label: customTooltip },
			},
		},
	},
}));
</script>
