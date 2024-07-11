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
import { computed, onMounted, shallowRef, watch } from "vue";
import { BarWithErrorBarsChart, IErrorBarXYDataPoint } from "chartjs-chart-error-bars";
import { mean } from "simple-statistics";
import { FlattedResult, createFormatter, Summary, FixedFormatter, MetricMeta } from "esbench";
import { TooltipItem } from "chart.js";
import { UseDataFilterReturn, diagonalPattern } from "./utils.ts";

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
		case "number":
			return { y: value };
		case "undefined":
			return { y: 0 };
		case "object":
			return {
				y: mean(value),
				yMin: Math.min(...value),
				yMax: Math.max(...value),
			};
	}
	throw new TypeError("Cannot draw string to chart");
}

function getPreviousPoints(meta: MetricMeta) {
	const { previous, filter: { matches } } = props;
	const { key } = meta;

	if (!previous.meta.get(key)) {
		return [];
	}
	return matches.value.map(v => getDataPoint(key, v && previous.find(v)));
}

function scale(meta: MetricMeta, points: ChartDataPoint[]) {
	const formatter = createFormatter(meta.format);
	if (!formatter.fixed) {
		return formatter as Partial<FixedFormatter>;
	}
	const values = points.map(p => p.y);
	const fixedFormatter = formatter.fixed(values);

	const { scale } = fixedFormatter;
	for (const point of points) {
		point.y *= scale;
		if (point.yMin) {
			point.yMin *= scale;
		}
		if (point.yMax) {
			point.yMax *= scale;
		}
	}
	return fixedFormatter as Partial<FixedFormatter>;
}

const chartConfig = computed(() => {
	const { summary, filter: { matches, xAxis } } = props;

	const datasets = [];
	const scales: Record<string, any> = {};

	let i = 0;
	for (const [name, meta] of summary.meta) {
		// Non-comparable values should not be plotted on the chart.
		if (!meta.analysis) {
			continue;
		}
		const color = CHART_COLORS[(i++) % CHART_COLORS.length];
		const yAxisID = `y-${name}`;

		const cPoints = matches.value.map(v => getDataPoint(name, v));
		const pPoints = getPreviousPoints(meta);
		const points = [...cPoints, ...pPoints].filter(Boolean);

		const formatter = scale(meta, points);

		datasets.push({
			label: name,
			data: cPoints,
			yAxisID,
			formatter,
			backgroundColor: color,
		});

		if (pPoints.length !== 0) {
			const pat = diagonalPattern(color);
			datasets.push({
				label: `${name}-prev`,
				data: pPoints,
				yAxisID,
				formatter,
				backgroundColor: pat,
			});
		}

		const { unit } = formatter;
		scales[yAxisID] = {
			title: {
				display: true,
				text: unit ? `${name} (${unit})` : name,
			},
		};
	}

	const labels = [...summary.vars.get(xAxis.value)!];
	return { data: { labels, datasets }, scales };
});

function customTooltip(item: TooltipItem<"barWithErrorBars">) {
	const { label, formatter, data } = item.dataset as any;
	const point = data[item.dataIndex] as IErrorBarXYDataPoint;

	if (!point) {
		return console.log("No Point");
	}

	const { y, yMin, yMax } = point;
	const base = `${label}: ${y.toFixed(2)} ${formatter.unit}`;
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
