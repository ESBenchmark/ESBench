import { mean } from "simple-statistics";
import { Profiler, ProfilingContext } from "./profiling.js";
import { CurveFn, minimalLeastSquare } from "./math.js";

const curves: Record<string, CurveFn> = {
	"O(1)": _ => 1,
	"O(N)": n => n,
	"O(logN)": n => Math.log2(n),
	"O(NlogN)": n => n * Math.log2(n),
	"O(N^2)": n => n * n,
	"O(N^3)": n => n ** 3,
};

function getComplexity(input: number[], time: number[]) {
	let bestFit = Number.MAX_VALUE;
	let complexity = "O(1)";
	for (const [name, fn] of Object.entries(curves)) {
		const rms = minimalLeastSquare(input, time, fn);
		if (rms < bestFit) {
			bestFit = rms;
			complexity = name;
		}
	}
	return complexity;
}

export default class ComplexityProfiler implements Profiler {

	private readonly variable: string;
	private readonly metric: string;

	constructor(variable: string, metric: string) {
		this.variable = variable;
		this.metric = metric;
	}

	onFinish(ctx: ProfilingContext) {
		const { variable, metric } = this;
		const { params } = ctx.suite;

		const weights = new Array(params.length);
		let index = 0;
		let weight = 1;
		for (let i = weights.length - 1; i >= 0; i--) {
			const [k, values] = params[i];
			if (!values) {
				throw new Error(`${k} is not in variables`);
			}
			if (k === variable) {
				index = i;
			}
			weights[i] = weight;
			weight *= values.length;
		}

		function rec(depth: number, k: number) {
			if (depth === index) {
				return rec(depth + 1, k);
			}
			if (depth === weights.length) {
				return calc(k);
			}
			for (let i = 0; i < params[depth][1].length; i++) {
				rec(depth + 1, k + weights[depth] * i);
			}
		}

		const input = params[index][1];

		function calc(k: number) {
			const samples = Object.create(null);
			const mmap = Object.create(null);

			for (let i = 0; i < input.length; i++) {
				const p = k + i * weights[index];

				for (const [k, v] of Object.entries(ctx.scenes[p])) {
					if (!samples[k]) {
						samples[k] = new Array(input.length);
						mmap[k] = [];
					}
					mmap[k].push(v);

					const inputF = samples[k];
					const value = v[metric];
					if (Array.isArray(value)) {
						inputF[i] = mean(value);
					} else if (typeof value === "number") {
						inputF[i] = value;
					}
				}
			}

			for (const [name, values] of Object.entries(samples)) {
				const inputF = input.filter(Number.isFinite);
				const valuesF = values.filter(Number.isFinite);

				if (valuesF.length < 2) {
					continue;
				}

				const c = getComplexity(inputF, valuesF);
				for (const metrics of mmap[name]) {
					metrics.complexity = c;
				}
			}
		}

		rec(0, 0);
	}
}
