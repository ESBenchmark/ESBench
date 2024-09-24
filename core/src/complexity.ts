import { mean } from "simple-statistics";
import { Metrics, Profiler, ProfilingContext, SceneResult } from "./profiling.js";
import { Entries, ParamsAny, ParamsDef } from "./suite.js";
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
	if (Number.isFinite(value)) {
		// https://github.com/microsoft/TypeScript/issues/15048
		return value as number;
	} else if (Array.isArray(value)) {
		return mean(value);
	}
	const type = typeof value;
	if (type === "number") {
		throw new Error("Only finite number can be used to calculate complexity");
	}
	throw new Error(`Metric "${name}" has ${type} type and cannot be used to calculate complexity`);
}

export interface ComplexityOptions<T extends ParamsDef> {
	/**
	 * Parameter name of the input size, the parameter must have at least 2 values,
	 * and all values must be finite number.
	 */
	param: keyof T;

	/**
	 * Metric name of the case running time, typically "time", provided by TimeProfiler.
	 * Type of the metric value must be number or number[].
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
	private params!: Entries;

	constructor(options: ComplexityOptions<ParamsAny>) {
		this.metric = options.metric;
		this.param = options.param;
		this.curves = options.curves ?? defaultCurves;
	}

	onStart(ctx: ProfilingContext) {
		ctx.defineMetric({ key: "complexity" });
		const { params } = ctx.suite;

		// TODO: duplicate of Summary.sort()
		this.params = params;
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
		this.calculateAll(ctx, 0, 0);
	}

	calculateAll(ctx: ProfilingContext, i: number, w: number): void {
		const { index, weights } = this;
		const params = ctx.suite.params;

		if (i === weights.length) {
			return this.forEachGroup(ctx.scenes, w);
		}
		if (i === index) {
			return this.calculateAll(ctx, i + 1, w);
		}
		for (let j = 0; j < params[i][1].length; j++) {
			this.calculateAll(ctx, i + 1, w + weights[i] * j);
		}
	}

	forEachGroup(scenes: SceneResult[], w: number) {
		const { index, weights, metric, params } = this;
		const { length } = params[index][1];

		const metricsMap = new Map<string, Metrics[]>();
		const valueMap = new Map<string, number[]>();

		// Group metrics and the metric value by case name.
		for (let i = 0; i < length; i++) {
			const scene = scenes[w + i * weights[index]];

			for (const [name, metrics] of Object.entries(scene)) {
				let samples = valueMap.get(name);
				let metricsList = metricsMap.get(name);

				// Empty slots represent the case does not exist.
				if (!samples) {
					samples = new Array(length);
					valueMap.set(name, samples);
					metricsMap.set(name, metricsList = []);
				}

				metricsList!.push(metrics);
				samples[i] = getNumber(metric, metrics[metric]);
			}
		}

		for (const [name, values] of valueMap) {
			this.measure(values, metricsMap.get(name)!);
		}
	}

	measure(values: number[], metricList: Metrics[]) {
		const input = this.params[this.index][1] as number[];

		// Filter out `undefined` of absent cases.
		const valuesF: number[] = [];
		const inputF: number[] = [];
		for (let i = 0; i < values.length; i++) {
			if (Number.isFinite(values[i])) {
				inputF.push(input[i]);
				valuesF.push(values[i]);
			}
		}

		if (valuesF.length < 2) {
			return; // Minimum require 2 points.
		}

		let bestFit = Number.MAX_VALUE;
		let complexity;
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
