import { mean } from "simple-statistics";
import { Metrics, Profiler, ProfilingContext, SceneResult } from "./profiling.js";
import { ParamsAny, ParamsDef } from "./suite.js";
import { CurveFn, minimalLeastSquare } from "./math.js";

const defaultCurves: Record<string, CurveFn> = {
	"O(1)": _ => 1,
	"O(N)": n => n,
	"O(logN)": n => Math.log2(n),
	"O(NlogN)": n => n * Math.log2(n),
	"O(N^2)": n => n * n,
	"O(N^3)": n => n ** 3,
};

function getNumber(name: string, value: Metrics[number]) {
	if (typeof value === "number") {
		return value;
	} else if (Array.isArray(value)) {
		return mean(value);
	} else {
		throw new Error(`Metric "${name}" has ${typeof value} type and cannot be used to calculate complexity`);
	}
}

export interface ComplexityOptions<T extends ParamsDef> {
	/**
	 * Parameter name of the input size, the parameter must have at least 2 values,
	 * and all values must be finite number.
	 */
	param: keyof T;

	/**
	 * Metric name of the case running time, typically "time", provided by TimeProfiler.
	 */
	metric: string;

	/**
	 * Using customized complexity curves, and builtin curves are ignored.
	 *
	 * @example
	 * new ComplexityProfiler({
	 *     param: "length",
	 *     metric: "time",
	 *     curves: {
	 *         "O(N^4)": n => n ** 4,
	 *         "O(loglogN)": n => Math.log(Math.log(n)),
	 *     }
	 * })
	 */
	curves?: Record<string, CurveFn>;
}

export default class ComplexityProfiler implements Profiler {

	private readonly metric: string;
	private readonly param: string;
	private readonly curves: Record<string, CurveFn>;

	private index = NaN;
	private weights!: number[];
	private input!: number[];

	constructor(options: ComplexityOptions<ParamsAny>) {
		this.metric = options.metric;
		this.param = options.param;
		this.curves = options.curves ?? defaultCurves;
	}

	onStart(ctx: ProfilingContext) {
		ctx.defineMetric({ key: "complexity" });

		// TODO: duplicate of Summary.sort()
		const { params } = ctx.suite;
		this.weights = new Array(params.length);
		let weight = 1;
		for (let i = params.length - 1; i >= 0; i--) {
			const [k, values] = params[i];
			if (k === this.param) {
				this.index = i;
			}
			this.weights[i] = weight;
			weight *= values.length;
		}

		if (!params[this.index][1].every(Number.isFinite)) {
			throw new Error(`Param ${this.param} must be finite numbers`);
		}
	}

	onFinish(ctx: ProfilingContext) {
		const params = ctx.suite.params;
		this.input = params[this.index][1] as number[];
		this.calculateAll(ctx, 0, 0);
	}

	calculateAll(ctx: ProfilingContext, i: number, w: number): void {
		const { index, weights } = this;
		const params = ctx.suite.params;

		if (i === index) {
			return this.calculateAll(ctx, i + 1, w);
		}
		if (i === weights.length) {
			return this.handleGroup(ctx.scenes, w);
		}
		for (let j = 0; j < params[i][1].length; j++) {
			this.calculateAll(ctx, i + 1, w + weights[i] * j);
		}
	}

	handleGroup(scenes: SceneResult[], w: number) {
		const { index, weights, metric, input } = this;

		const metricsMap = new Map<string, Metrics[]>();
		const timeMap = new Map<string, number[]>();

		// Group metric values by cases.
		for (let i = 0; i < input.length; i++) {
			const scene = scenes[w + i * weights[index]];

			for (const [name, metrics] of Object.entries(scene)) {
				let samples = timeMap.get(name);
				let metricsList = metricsMap.get(name);

				if (!samples) {
					samples = new Array(input.length);
					timeMap.set(name, samples);
					metricsMap.set(name, metricsList = []);
				}

				metricsList!.push(metrics);
				samples[i] = getNumber(metric, metrics[metric]);
			}
		}

		for (const [name, values] of timeMap) {
			this.measure(values, metricsMap.get(name)!);
		}
	}

	measure(values: number[], metricList: Metrics[]) {
		const valuesF: number[] = [];
		const inputF: number[] = [];

		// Filter out `undefined` of absent cases.
		for (let i = 0; i < values.length; i++) {
			if (Number.isFinite(values[i])) {
				valuesF.push(values[i]);
				inputF.push(this.input[i]);
			}
		}

		if (valuesF.length < 2) {
			return; // Minimum require 2 points.
		}

		let bestFit = Number.MAX_VALUE;
		let complexity = "O(1)";
		for (const [type, f] of Object.entries(this.curves)) {
			const rms = minimalLeastSquare(inputF, valuesF, f);
			if (rms < bestFit) {
				bestFit = rms;
				complexity = type;
			}
		}

		for (const metrics of metricList) {
			metrics.complexity = complexity;
		}
	}
}
