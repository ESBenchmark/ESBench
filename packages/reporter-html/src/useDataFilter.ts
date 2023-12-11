import { computed, ComputedRef, reactive, Ref, watch } from "vue";
import { FlattedResult, FlattedSummary } from "@esbench/core/client";

type Predicate = (result: FlattedResult, name: string, value: string) => boolean;

export interface VariableDef {
	type: Predicate;
	name: string;
	values: string[];
}

export interface UseDataFilterReturn {
	defs: ComputedRef<VariableDef[]>;
	variables: string[];
	reset: () => void;
	selects: ComputedRef<FlattedResult[]>;
}

function topLevel(result: FlattedResult, name: string, value: string) {
	return (result as any)[name] === value;
}

function param(result: FlattedResult, name: string, value: string) {
	return result.params[name] === value;
}

export default function (summary: Ref<FlattedSummary>) {
	const variables = reactive<string[]>([]);

	const defs = computed(() => {
		const { builders, engines, params } = summary.value;
		const defs: VariableDef[] = [];

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

	const selects = computed(() => {
		return summary.value.list.filter(v => {
			for (let i = 0; i < defs.value.length; i++) {
				const { type, name } = defs.value[i];
				if (!type(v, name, variables[i])) {
					return false;
				}
			}
			return true;
		});
	});

	function reset() {
		variables.length = 0;
		for (const def of defs.value) {
			variables.push(def.values[0]);
		}
	}

	watch(summary, reset, { immediate: true });

	return { defs, variables, selects, reset } as UseDataFilterReturn;
}
