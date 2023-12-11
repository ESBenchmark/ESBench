import { computed, ComputedRef, reactive, ref, Ref, watch } from "vue";
import { FlattedResult, FlattedSummary } from "@esbench/core/client";

type Predicate = (result: FlattedResult, name: string) => string;

export interface VariableDef {
	type: Predicate;
	name: string;
	values: string[];
}

export interface UseDataFilterReturn {
	defs: ComputedRef<VariableDef[]>;
	variables: string[];
	xAxis: Ref<number>;
	matches: ComputedRef<FlattedResult[]>;
}

function topLevel(result: FlattedResult, name: string) {
	return (result as any)[name];
}

function param(result: FlattedResult, name: string) {
	return result.params[name];
}

export default function (summary: Ref<FlattedSummary>) {
	const variables = reactive<string[]>([]);
	const xAxis = ref(0);

	const defs = computed(() => {
		const { names, builders, engines, params } = summary.value;
		const defs: VariableDef[] = [];

		if (names.size > 0) {
			defs.push({ type: topLevel, name: "name", values: [...names] });
		}
		if (builders.size > 0) {
			defs.push({ type: topLevel, name: "builder", values: [...builders] });
		}
		if (engines.size > 0) {
			defs.push({ type: topLevel, name: "engine", values: [...engines] });
		}

		for (const [name, values] of Object.entries(params)) {
			defs.push({ type: param, name, values: [...values] });
		}

		return defs;
	});

	const matches = computed(() => {
		return summary.value.list.filter(v => {
			for (let i = 0; i < defs.value.length; i++) {
				if (i === xAxis.value) {
					continue;
				}
				const { type, name } = defs.value[i];
				if (type(v, name) !== variables[i]) {
					return false;
				}
			}
			return true;
		});
	});

	function reset() {
		xAxis.value = variables.length = 0;
		for (const def of defs.value) {
			variables.push(def.values[0]);
		}
	}

	watch(summary, reset, { immediate: true });

	return { defs, variables, matches, xAxis } as UseDataFilterReturn;
}
