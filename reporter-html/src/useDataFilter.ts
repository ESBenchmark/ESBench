import { computed, ComputedRef, ref, Ref, watch } from "vue";
import { FlattedResult, Summary } from "esbench";
import { firstItem } from "@kaciras/utilities/browser";

export interface UseDataFilterReturn {
	variables: Ref<string[]>;
	xAxis: Ref<string>;
	matches: ComputedRef<FlattedResult[]>;
}

export default function (stf: Ref<Summary>) {
	const variables = ref<string[]>([]);
	const xAxis = ref("");

	const matches = computed(() => {
		return stf.value.findAll(variables.value, xAxis.value);
	});

	function reset() {
		const summary = stf.value;
		xAxis.value = summary.baseline?.type ??
			firstItem(summary.vars.keys())!;
		variables.value = summary.createVariableArray();
	}

	watch(stf, reset, { immediate: true });

	return { variables, matches, xAxis } as UseDataFilterReturn;
}
