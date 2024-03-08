<template>
	<!-- Chart.js uses parent container to update display sizes -->
	<section><canvas ref='canvasRef'/></section>
</template>

<script setup lang="ts">
import { mean } from "simple-statistics";
import { computed, onMounted, shallowRef, watch } from "vue";
import { BarWithErrorBarsChart, IErrorBarXYDataPoint } from "chartjs-chart-error-bars";
import { FlattedResult, MetricMeta, parseFormat, Summary } from "esbench";
import { UnitConvertor } from "@kaciras/utilities/browser";
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

const canvasRef = shallowRef();

function getDataPoint(name: string, result?: FlattedResult): ChartDataPoint {
	if (!result) {
		return { y: 0 };
	}
	const value = getMetrics(result)[name];
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

let chart: BarWithErrorBarsChart;

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d")!;

// https://github.com/ashiguruma/patternomaly/blob/master/src/shapes/diagonal.js
function createPattern(background: string, size = 20) {
	const halfSize = size / 2;
	canvas.width = size;
	canvas.height = size;

	ctx.fillStyle = background;
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.beginPath();
	ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
	ctx.lineJoin = "round";
	ctx.lineCap = "round";
	ctx.lineWidth = size / 10;

	drawDiagonalLine(size);
	drawDiagonalLine(size, halfSize, halfSize);
	ctx.closePath();

	ctx.stroke();
	return ctx.createPattern(canvas, null)!;
}

function drawDiagonalLine(size: number, offsetX = 0, offsetY = 0) {
	const halfSize = 20 / 2;
	const gap = 1;
	ctx.moveTo((halfSize - gap) - offsetX, (gap * -1) + offsetY);
	ctx.lineTo((size + 1) - offsetX, (halfSize + 1) + offsetY);
}

function homogeneous(this: UnitConvertor, values: Iterable<number | undefined | null>, unit?: string) {
	const { fractions, units } = this;
	const x = this.getFraction(unit);
	let min = Infinity;

	for (let value of values) {
		value = Math.abs(value ?? 0);
		min = value === 0 // 0 is equal in any unit.
			? min
			: Math.min(min, this.suit(value * x));
	}
	if (min === Infinity) {
		min = 0; // All values are 0, use the minimum unit.
	}

	const scale = x / fractions[min];
	const newUnit = units[min];
	return { scale, newUnit };
}

function scale(meta: MetricMeta, points: ChartDataPoint[]) {
	if (!meta.format) {
		return "";
	}
	const yValues = points.map(p => p.y);
	const { formatter, rawUnit, suffix } = parseFormat(meta.format);
	const { scale, newUnit } = homogeneous.call(formatter, yValues, rawUnit);

	for (const point of points) {
		point.y *= scale;
		if (point.yMin) {
			point.yMin *= scale;
		}
		if (point.yMax) {
			point.yMax *= scale;
		}
	}

	return newUnit + suffix;
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
		const yAxisID = `y-${name}`;
		const toDataPoint = getDataPoint.bind(null, name);

		const cv = matches.value.map(toDataPoint);
		let pv: typeof cv = [];

		if (meta.analysis && previous.meta.get(name)) {
			pv = matches.value.map(v => toDataPoint(previous.find(v)));
		}

		const unit = scale(meta, [...cv, ...pv]);

		if (meta.analysis && previous.meta.get(name)) {
			datasets.push({
				label: `${name}-prev`,
				yAxisID,
				unit,
				data: pv,
				backgroundColor: createPattern(color),
			});
		}

		datasets.push({
			label: name,
			yAxisID,
			unit,
			data: cv,
			backgroundColor: color,
		});

		scales[yAxisID] = {
			title: { display: true, text: `${name} (${unit})` },
		};
	}

	return {
		data: { labels, datasets },
		options: {
			scales,
			responsive: true,
			plugins: {
				legend: { position: "top" },
				tooltip: {
					callbacks: {
						label: customTooltip,
					},
				},
			},
		},
	};
});

function customTooltip(item: TooltipItem<"barWithErrorBars">) {
	const { label, unit, data } = item.dataset as any;
	const point = data[item.dataIndex] as IErrorBarXYDataPoint;

	if (!point) {
		return console.log("No Point");
	}

	const { y, yMin, yMax } = point;
	const base = `${label}: ${y.toFixed(2)} ${unit}`;
	if (typeof yMin !== "number" || typeof yMax !== "number") {
		return base;
	}
	return `${base} (${yMin.toFixed(2)} ~ ${yMax.toFixed(2)})`;
}

watch(data, newData => {
	chart.data = newData.data;
	chart.options = newData.options;
	chart.update("none");
});

onMounted(() => {
	chart = new BarWithErrorBarsChart(canvasRef.value, data.value);
});
</script>
