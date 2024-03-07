<template>
	<section>
		<LabeledSelect v-model='errorBarType' label='Error bar type'>
			<option :value='pointFactories.none'>None</option>
			<option :value='pointFactories.valueRange'>Value Range</option>
			<option :value='pointFactories.stdDev'>Standard Deviation</option>
			<option :value='pointFactories.stdErr'>Standard Error</option>
		</LabeledSelect>

		<canvas ref='canvasRef' :class='$style.canvas'/>
	</section>
</template>

<script setup lang="ts">
import { mean, standardDeviation } from "simple-statistics";
import { computed, onMounted, shallowRef, watch } from "vue";
import { BarWithErrorBarsChart, IErrorBarXYDataPoint } from "chartjs-chart-error-bars";
import { parseFormat, Summary } from "esbench";
import { UnitConvertor } from "@kaciras/utilities/browser";
import { TooltipItem } from "chart.js";
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
	none: (y: number, values: number[]) => ({ y }),

	stdDev(y: number, values: number[]) {
		const e = standardDeviation(values);
		return { y, yMin: y - e, yMax: y + e };
	},

	stdErr(y: number, values: number[]) {
		const e = standardDeviation(values) / Math.sqrt(values.length);
		return { y, yMin: y - e, yMax: y + e };
	},

	valueRange(y: number, values: number[]) {
		return { y, yMin: values.at(0), yMax: values.at(-1) };
	},
};

const errorBarType = shallowRef(pointFactories.valueRange);
const canvasRef = shallowRef();

let chart: BarWithErrorBarsChart;

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
		const { formatter, unit, suffix } = parseFormat(meta.format);

		const cv = matches.value.map(v => getMetrics(v)[name]);
		const cn = cv.map(m => Array.isArray(m) ? mean(m) : m);

		let scale: number;
		let newUnit: string;
		let uas: string;

		if (meta.analysis && previous.meta.get(name)) {
			const pv = matches.value.map(v => {
				const p = previous.find(v);
				return p && getMetrics(p)[name];
			});
			const pn = pv.map(m => Array.isArray(m) ? mean(m) : m);

			cn.push(...pn);
			({ scale, newUnit } = homogeneous.call(formatter, cn as any, unit));
			uas = newUnit + suffix;

			datasets.push({
				label: `${name}-prev`,
				yAxisID,
				unit: uas,
				data: pv.map((d, i) => {
					if (!Array.isArray(d)) {
						return { y: (d ?? 0) * scale };
					}
					return errorBarType.value(pn[i] as number * scale, d.map(n => n * scale));
				}),
				backgroundColor: createPattern(color),
			});
		} else {
			({ scale, newUnit } = homogeneous.call(formatter, cn as any, unit));
			uas = newUnit + suffix;
		}

		scales[yAxisID] = {
			title: {
				display: true,
				text: `${name} (${newUnit}${suffix})`,
			},
		};

		datasets.push({
			label: name,
			yAxisID,
			unit: uas,
			data: cv.map((r, i) => {
				if (!Array.isArray(r)) {
					return { y: (r ?? 0) * scale };
				}
				return errorBarType.value(cn[i] as number * scale, r.map(n => n * scale));
			}),
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
	const { y, yMin, yMax } = data[item.dataIndex] as IErrorBarXYDataPoint;

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

<style module>
.canvas {
	aspect-ratio: 1/2;
}
</style>
