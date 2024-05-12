import { cartesianObject, firstItem } from "@kaciras/utilities/browser";
import { defineSuite, MetricMeta, ResolvedNote, ResultBaseline, Summary, ToolchainResult } from "esbench";
import data from "./380-no-metric.json" with { type: "json" };

const results = data["es/map-object.js"] as unknown as ToolchainResult[];

const kMetrics = Symbol("metrics");
const kIndex = Symbol("index");

class V1_JSON_Hash {

	readonly vars = new Map<string, Set<string>>();
	readonly meta = new Map<string, MetricMeta>();
	readonly table: any[] = [];
	readonly notes: ResolvedNote[] = [];
	readonly hashTable = new Map<string, any>();

	keys!: string[];
	baseline?: ResultBaseline;

	constructor(suiteResult: ToolchainResult[]) {
		this.vars.set("Name", new Set());
		for (const result of suiteResult) {
			this.addResult(result);
		}
		this.keys = Array.from(this.vars.keys());
		const [name, ...rest] = this.keys;
		this.sort([...rest, name]);
	}

	addResult(toolchain: ToolchainResult) {
		const { executor, builder, paramDef, scenes, notes } = toolchain;
		const offset = this.table.length;
		const iter = cartesianObject(paramDef)[Symbol.iterator]();
		this.baseline = toolchain.baseline;

		if (executor) {
			this.addToVar("Executor", executor);
		}
		if (builder) {
			this.addToVar("Builder", builder);
		}
		for (const [key, values] of paramDef) {
			this.addToVar(key, ...values);
		}

		for (const [k, v] of Object.entries(toolchain.meta)) {
			this.meta.set(k, v);
		}
		for (const scene of scenes) {
			const params = iter.next().value;
			for (const [name, metrics] of Object.entries(scene)) {
				const flatted = {
					Name: name,
					Executor: executor,
					Builder: builder,
					...params,
					[kMetrics]: metrics,
				};
				this.table.push(flatted);
				this.hashTable.set(JSON.stringify(flatted), flatted);
				this.addToVar("Name", name);
			}
		}
		for (const { type, text, caseId } of notes) {
			const resolved: ResolvedNote = { type, text };
			this.notes.push(resolved);
			if (caseId !== undefined) {
				resolved.case = this.table[offset + caseId];
			}
		}
	}

	private addToVar(name: string, ...values: string[]) {
		let list = this.vars.get(name);
		if (!list) {
			this.vars.set(name, list = new Set());
		}
		for (const value of values) list.add(value);
	}

	static getMetrics(item: any) {
		return item[kMetrics];
	}

	sort(varNames: string[]) {
		const src: Array<[string, Iterable<string>]> = [];
		for (const key of varNames) {
			const values = this.vars.get(key)!;
			if (!values) {
				throw new Error(`${key} is not in variables`);
			}
			src.push([key, values]);
		}
		let index = 0;
		for (const properties of cartesianObject(src)) {
			const item = this.find(properties);
			if (item) {
				item[kIndex] = index++;
			}
		}
		this.table.sort((a, b) => a[kIndex] - b[kIndex]);
	}

	split(ignore: string) {
		const keys = this.keys.filter(k => k !== ignore);
		return Map.groupBy(this.table, item => JSON.stringify(item, keys));
	}

	find(variables: Record<string, string>) {
		return this.hashTable.get(JSON.stringify(variables, this.keys));
	}

	findAll(variables: Record<string, string>, axis: string) {
		const copy = { ...variables };
		return [...this.vars.get(axis)!].map(v => {
			copy[axis] = v;
			return this.hashTable.get(JSON.stringify(copy, this.keys));
		});
	}
}

export default defineSuite({
	params: {
		impl: [Summary, V1_JSON_Hash],
	},
	baseline: {
		type: "impl",
		value: Summary,
	},
	setup(scene) {
		const summary = new scene.params.impl(results);

		const reverse = [...summary.vars.keys()].reverse();
		const variables: Record<string, string> = {};
		for (const [k, vs] of summary.vars) {
			variables[k] = firstItem(vs)!;
		}

		scene.bench("sort", () => summary.sort(reverse));
		scene.bench("split", () => summary.split("n"));
		scene.bench("find", () => summary.find(variables));
		scene.bench("findAll", () => summary.findAll(variables, "n"));
	},
});
