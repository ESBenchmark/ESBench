import { cartesianObject, firstItem, MultiMap } from "@kaciras/utilities/browser";
import { defineSuite, Summary } from "esbench";
import data from "./380-no-metric.json" with { type: "json" };

const kMetrics = Symbol("metrics");
const kIndex = Symbol("index");

function groupByPolyfill(items, callbackFn) {
	const group = new MultiMap();
	for (const element of items) {
		group.add(callbackFn(element), element);
	}
	return group;
}

const groupBy = Map.groupBy ?? groupByPolyfill;

class V1_JSON_Hash {
	/**
	 * All variables and each of their possible values.
	 */
	vars = new Map();
	/**
	 * Descriptions of metrics.
	 *
	 * @see ProfilingContext.meta
	 */
	meta = new Map();
	table = [];
	/**
	 * Additional noteworthy information generated during the run of the suite.
	 *
	 * @see ProfilingContext.warn
	 * @see ProfilingContext.note
	 */
	notes = [];
	baseline;
	hashTable = new Map();
	keys;

	constructor(suiteResult) {
		// Ensure the Name is the first entry.
		this.vars.set("Name", new Set());
		for (const result of suiteResult) {
			this.addResult(result);
		}
		this.keys = Array.from(this.vars.keys());
		const [name, ...rest] = this.keys;
		this.sort([...rest, name]);
	}

	addResult(toolchain) {
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
			const resolved = { type, text };
			this.notes.push(resolved);
			if (caseId !== undefined) {
				resolved.row = this.table[offset + caseId];
			}
		}
	}

	addToVar(name, ...values) {
		let list = this.vars.get(name);
		if (!list) {
			this.vars.set(name, list = new Set());
		}
		for (const value of values)
			list.add(value);
	}

	static getMetrics(item) {
		return item[kMetrics];
	}

	sort(varNames) {
		const src = [];
		for (const key of varNames) {
			const values = this.vars.get(key);
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

	group(ignore) {
		const keys = this.keys.filter(k => k !== ignore);
		return groupBy(this.table, item => JSON.stringify(item, keys));
	}

	find(variables) {
		return this.hashTable.get(JSON.stringify(variables, this.keys));
	}

	findAll(variables, axis) {
		const copy = { ...variables };
		return [...this.vars.get(axis)].map(v => {
			copy[axis] = v;
			return this.hashTable.get(JSON.stringify(copy, this.keys));
		});
	}
}

export default defineSuite({
	name: "Summary",
	params: {
		impl: [Summary, V1_JSON_Hash],
	},
	baseline: {
		type: "impl",
		value: "Summary()",
	},
	setup(scene) {
		const summary = new scene.params.impl(Object.values(data)[0]);

		const reverse = [...summary.vars.keys()].reverse();
		const variables = {};
		for (const [k, vs] of summary.vars) {
			variables[k] = firstItem(vs);
		}

		scene.bench("sort", () => summary.sort(reverse));
		scene.bench("group", () => summary.group("n"));
		scene.bench("find", () => summary.find(variables));
		scene.bench("findAll", () => summary.findAll(variables, "n"));
	},
});
