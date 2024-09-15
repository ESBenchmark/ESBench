import { mean } from "simple-statistics";
import { Metrics, Profiler, ProfilingContext } from "./profiling.js";
import { CurveFn, minimalLeastSquare } from "./math.js";

const curves: Array<string | CurveFn> = [
	"O(1)", _ => 1,
	"O(N)", n => n,
	"O(logN)", n => Math.log2(n),
	"O(NlogN)", n => n * Math.log2(n),
	"O(N^2)", n => n * n,
	"O(N^3)", n => n ** 3,
];

export default class ComplexityProfiler implements Profiler {

	private readonly variable: string;
	private readonly metric: string;

	private index = NaN;
	private weights!: number[];

	constructor(variable: string, metric: string) {
		this.variable = variable;
		this.metric = metric;
	}

	onStart(ctx: ProfilingContext) {
		ctx.defineMetric({ key: "complexity" });

		const { params } = ctx.suite;
		this.weights = new Array(params.length);
		let weight = 1;
		for (let i = params.length - 1; i >= 0; i--) {
			const [k, values] = params[i];
			if (!values) {
				throw new Error(`${k} is not in variables`);
			}
			if (k === this.variable) {
				this.index = i;
			}
			this.weights[i] = weight;
			weight *= values.length;
		}
	}

	onFinish(ctx: ProfilingContext) {
		const { index, weights, metric } = this;
		const params = ctx.suite.params;
		const input = params[index][1] as number[];

		arrange(0, 0);

		function arrange(depth: number, k: number) {
			if (depth === index) {
				return arrange(depth + 1, k);
			}
			if (depth === weights.length) {
				return calculate(k);
			}
			for (let i = 0; i < params[depth][1].length; i++) {
				arrange(depth + 1, k + weights[depth] * i);
			}
		}

		function calculate(k: number) {
			const metricsMap = new Map<string, Metrics[]>();
			const timeMap = new Map<string, number[]>();

			for (let i = 0; i < input.length; i++) {
				const scene = ctx.scenes[k + i * weights[index]];

				for (const [name, metrics] of Object.entries(scene)) {
					let samples = timeMap.get(name);
					let metricsList = metricsMap.get(name);

					if (!samples) {
						metricsMap.set(name, metricsList = []);
						timeMap.set(name, samples = new Array(input.length));
					}

					metricsList!.push(metrics);

					const value = metrics[metric];
					if (typeof value === "number") {
						samples[i] = value;
					} else if (Array.isArray(value)) {
						samples[i] = mean(value);
					}
				}
			}

			for (const [name, values] of timeMap) {
				const inputF: number[] = [];
				const valuesF: number[] = [];

				// Filter out `undefined` from absent cases.
				for (let i = 0; i < values.length; i++) {
					if (Number.isFinite(values[i])) {
						inputF.push(input[i]);
						valuesF.push(values[i]);
					}
				}

				if (valuesF.length < 2) {
					continue; // Minimum require 2 points.
				}

				let bestFit = Number.MAX_VALUE;
				let complexity = "O(1)";
				for (let i = 0; i < curves.length; i += 2) {
					const f = curves[i + 1] as CurveFn;
					const rms = minimalLeastSquare(inputF, valuesF, f);
					if (rms < bestFit) {
						bestFit = rms;
						complexity = curves[i] as string;
					}
				}

				for (const metrics of metricsMap.get(name)!) {
					metrics.complexity = complexity;
				}
			}
		}
	}
}
