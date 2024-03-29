import { computed, ComputedRef, reactive, ref, Ref, watch } from "vue";
import { FlattedResult, Summary } from "esbench";
import { firstItem } from "@kaciras/utilities/browser";

export interface UseDataFilterReturn {
	variables: Record<string, string>;
	xAxis: Ref<string>;
	matches: ComputedRef<FlattedResult[]>;
}

export default function (summaryRef: Ref<Summary>) {
	const variables = reactive<Record<string, string>>({});
	const xAxis = ref("");

	const matches = computed(() => {
		return summaryRef.value.findAll(variables, xAxis.value);
	});

	function reset() {
		const summary = summaryRef.value;
		xAxis.value = summary.baseline?.type
			?? firstItem(summary.vars.keys())!;
		for (const [k, vs] of summary.vars) {
			variables[k] = firstItem(vs)!;
		}
	}

	watch(summaryRef, reset, { immediate: true });

	return { variables, matches, xAxis } as UseDataFilterReturn;
}
