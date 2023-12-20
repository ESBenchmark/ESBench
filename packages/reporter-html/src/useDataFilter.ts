import { computed, ComputedRef, ref, Ref, watch } from "vue";
import { firstItem, FlattedResult, SummaryTableFilter } from "@esbench/core/client";

export interface UseDataFilterReturn {
	variables: Ref<string[]>;
	xAxis: Ref<string>;
	matches: ComputedRef<FlattedResult[]>;
}

export default function (stf: Ref<SummaryTableFilter>) {
	const variables = ref<string[]>([]);
	const xAxis = ref("");

	const matches = computed(() => {
		return stf.value.select(variables.value, xAxis.value);
	});

	function reset() {
		xAxis.value = firstItem(stf.value.vars.keys())!;
		variables.value = stf.value.createOptions();
	}

	watch(stf, reset, { immediate: true });

	return { variables, matches, xAxis } as UseDataFilterReturn;
}
