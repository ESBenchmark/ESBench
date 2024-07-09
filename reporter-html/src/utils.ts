import { computed, ComputedRef, reactive, ref, Ref, watch } from "vue";
import { FlattedResult, Summary } from "esbench";
import { firstItem } from "@kaciras/utilities/browser";

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d")!;

// https://github.com/ashiguruma/patternomaly/blob/master/src/shapes/diagonal.js
export function diagonalPattern(background: string, size = 20) {
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

export interface UseDataFilterReturn {
	variables: Record<string, string>;
	xAxis: Ref<string>;
	matches: ComputedRef<FlattedResult[]>;
}

export function useDataFilter(summaryRef: Ref<Summary>) {
	const variables = reactive<Record<string, string>>({});
	const xAxis = ref("");

	const matches = computed(() => {
		return summaryRef.value.findAll(variables, xAxis.value);
	});

	function reset() {
		const { vars, baseline } = summaryRef.value;
		for (const [key, values] of vars) {
			variables[key] = firstItem(values)!;
		}
		xAxis.value = baseline?.type ?? firstItem(vars.keys())!;
	}

	watch(summaryRef, reset, { immediate: true });

	return { variables, matches, xAxis } as UseDataFilterReturn;
}
