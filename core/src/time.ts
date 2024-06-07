import { AsyncFunction, asyncNoop, Awaitable, durationFmt, noop } from "@kaciras/utilities/browser";
import { medianSorted } from "simple-statistics";
import { welchTest } from "./math.js";
import { BenchCase } from "./suite.js";
import { runFns } from "./utils.js";
import { MetricAnalysis, Metrics, Profiler, ProfilingContext } from "./profiling.js";

interface Iterator {
	calls: number;
	iterate: (count: number) => Awaitable<number>;
}

export function unroll(factor: number, isAsync: boolean) {
	const [call, FunctionType] = isAsync
		? ["await f()", AsyncFunction]
		: ["f()", Function];

	const body = `\
		const start = performance.now();
		while (count--) {
			${new Array(factor).fill(call).join("\n")}
		}
		return performance.now() - start;
	`;
	return new FunctionType("f", "count", body);
}

function createIterator(factor: number, case_: BenchCase): Iterator {
	const { fn, isAsync, beforeHooks, afterHooks } = case_;

	async function syncWithHooks(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runFns(beforeHooks);

			timeUsage -= performance.now();
			fn();
			timeUsage += performance.now();

			await runFns(afterHooks);
		}
		return timeUsage;
	}

	async function asyncWithHooks(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runFns(beforeHooks);

			timeUsage -= performance.now();
			await fn();
			timeUsage += performance.now();

			await runFns(afterHooks);
		}
		return timeUsage;
	}

	if (beforeHooks.length | afterHooks.length) {
		return {
			calls: 1,
			iterate: isAsync ? asyncWithHooks : syncWithHooks,
		};
	} else {
		return {
			calls: factor,
			iterate: unroll(factor, isAsync).bind(null, fn),
		};
	}
}

function timeDetail(time: number, count: number) {
	const total = durationFmt.formatDiv(time, "ms");
	const mean = durationFmt.formatDiv(time / count, "ms");
	return `${count} operations, ${total}, ${mean}/op`;
}

export interface TimingOptions {
	/**
	 * How many target iterations should be performed. The value must >= 1.
	 *
	 * @default 10
	 */
	samples?: number;

	/**
	 * How many warmup iterations should be performed. The value can be 0, which disables warmup.
	 *
	 * @default 5
	 */
	warmup?: number;

	/**
	 * Invocation count or time in a single sample.
	 *
	 * If is a duration string, it used by Pilot stage to estimate the number of invocations per sample.
	 *
	 * If the value is a number, it must be a multiple of `unrollFactor`, the load will call the given
	 * number of times for each sample. It's better for benchmarks which doesn't have a steady state
	 * and the performance distribution is tricky.
	 *
	 * If the value is less than the `unrollFactor`, `unrollFactor` will be forced to be the same.
	 *
	 * @default "1s"
	 */
	iterations?: number | string;

	/**
	 * How many times the benchmark method will be invoked per one iteration of a generated loop.
	 *
	 * It can be ignored if `iterations` is a duration and the workload takes long time.
	 *
	 * @default 16
	 */
	unrollFactor?: number;

	/**
	 * Specifies if the overhead should be evaluated (Idle runs) and it's average value
	 * subtracted from every result. Very important for nano-benchmarks.
	 *
	 * @default true
	 */
	evaluateOverhead?: boolean;
}

/**
 * A tool used for accurately measure the execution time of a benchmark case.
 *
 * @example
 * const profiler = {
 *     async onCase(ctx, case_, metrics) {
 *         const measurement = new ExecutionTimeMeasurement(ctx, case_);
 * 		   const samples = await measurement.run();
 * 		   ctx.info(`Samples: [${samples.join(", ")}]`);
 *     },
 * }
 */
export class ExecutionTimeMeasurement {

	private readonly ctx: ProfilingContext;
	private readonly benchCase: BenchCase;
	private readonly options: Required<TimingOptions>;

	constructor(ctx: ProfilingContext, case_: BenchCase, options?: TimingOptions) {
		this.ctx = ctx;
		this.benchCase = case_;
		this.options = ExecutionTimeMeasurement.normalize(options);
	}

	static normalize(options: TimingOptions = {}) {
		const normalized = {
			unrollFactor: options.unrollFactor ?? 16,
			samples: options.samples ?? 10,
			warmup: options.warmup ?? 5,
			iterations: options.iterations ?? "1s",
			evaluateOverhead: options.evaluateOverhead !== false,
		};

		const { unrollFactor, iterations, samples } = normalized;
		if (samples <= 0) {
			throw new Error("The number of samples must be at least 1");
		}
		if (unrollFactor < 1) {
			throw new Error("The unrollFactor must be at least 1");
		}

		if (typeof iterations === "number") {
			if (iterations <= 0) {
				throw new Error("The number of iterations cannot be 0 or negative");
			}
			if (iterations < unrollFactor) {
				normalized.unrollFactor = iterations;
			} else if (iterations % unrollFactor !== 0) {
				throw new Error("iterations must be a multiple of unrollFactor");
			}
		}
		return normalized as Required<TimingOptions>;
	}

	async run() {
		const { ctx, benchCase, options } = this;
		const { samples, unrollFactor, evaluateOverhead } = options;

		let { iterations } = options;
		let iterator: Iterator;

		if (typeof iterations === "string") {
			[iterations, iterator] = await this.estimate(iterations);
			await ctx.info();
		} else {
			iterator = createIterator(unrollFactor, benchCase);
		}

		iterations = Math.round(iterations / iterator.calls);

		const time = await this.measure("Actual", iterator, iterations);
		if (evaluateOverhead && samples > 1) {
			await ctx.info();
			await this.subtractOverhead(iterations, time);
		}
		return time;
	}

	/*
	 * Another idea is treat iteration hooks as overhead, run them with an empty benchmark,
	 * then subtract the time from result.
	 * but this cannot handle some cases. for example, consider the code:
	 *
	 * let data = null;
	 * scene.bench("foo", () => data = create());
	 * scene.afterIteration(() => {
	 *     if (data) heavyCleanup(data);
	 * });
	 *
	 * If we replace the benchmark function with `noop`, `heavyCleanup` will not be called.
	 */
	async subtractOverhead(iterations: number, time: number[]) {
		const { benchCase, ctx } = this;
		const overheads = await this.measureOverhead(iterations);

		if (welchTest(time, overheads, "greater") < 0.05) {
			const overhead = medianSorted(overheads);
			for (let i = 0; i < time.length; i++) {
				time[i] -= overhead;
			}
		} else {
			time.length = 1;
			time[0] = 0;
			ctx.note("warn",
				"The function duration is indistinguishable from the empty function duration.", benchCase);
		}
	}

	async measureOverhead(iterations: number) {
		const { benchCase } = this;

		const fn = benchCase.fn.constructor === Function ? noop : asyncNoop;
		const c = benchCase.derive(benchCase.isAsync, fn);

		const iterate = createIterator(this.options.unrollFactor, c);
		return this.measure("Overhead", iterate, iterations);
	}

	async estimate(target: string) {
		const { options: { unrollFactor }, benchCase } = this;

		const targetMS = durationFmt.parse(target, "ms");
		if (targetMS <= 0) {
			throw new Error("Iteration time must be > 0");
		}

		// Make a rough estimate before unrolling, avoid exceeding the target.
		let iterator = createIterator(1, benchCase);
		let unrolled = false;
		let count = 1;
		let downCount = 0;

		while (count < Number.MAX_SAFE_INTEGER) {
			const n = Math.round(count / iterator.calls);
			const time = await iterator.iterate(n);
			await this.ctx.info(`Pilot: ${timeDetail(time, n)}`);

			if (time === 0) {
				count *= 8;
				continue; // Less than the precision, re-run with larger count.
			}

			const previous = count;
			count = Math.max(1, count * targetMS / time);

			// Unroll it after enough count to keep the time stable.
			if (!unrolled && count > unrollFactor * 100) {
				unrolled = true;
				iterator = createIterator(unrollFactor, benchCase);
			}

			if (
				Math.abs(previous - count) < iterator.calls
				|| count < previous && ++downCount >= 3
			) {
				return [previous, iterator] as const;
			}
		}
		throw new Error("Iteration time is too long and the fn runs too fast");
	}

	async measure(name: string, iterator: Iterator, count: number) {
		const { ctx } = this;
		const { warmup, samples } = this.options;
		const { iterate, calls } = iterator;

		const timeUsageList = new Array(samples);
		const n = count * calls;

		for (let i = 0; i < warmup; i++) {
			const time = await iterate(count);
			await ctx.info(`${name} Warmup ${i}: ${timeDetail(time, n)}`);
		}

		await ctx.info();

		for (let i = 0; i < samples; i++) {
			const time = await iterate(count);
			timeUsageList[i] = time / n;
			await ctx.info(`${name} ${i}: ${timeDetail(time, n)}`);
		}

		return timeUsageList.sort((a, b) => a - b);
	}
}

export interface TimeProfilerOptions extends TimingOptions {
	/**
	 * Measure throughput (ops/<unit>) instead of time (time/op).
	 * The value can be a duration unit.
	 *
	 * @example
	 * defineSuite({ timing: { throughput: "s" } });
	 * | No. |   Name |   throughput |
	 * | --: | -----: | -----------: |
	 * |   0 | object | 14.39M ops/s |
	 * |   1 |    map | 17.32M ops/s |
	 */
	throughput?: string;
}

export class TimeProfiler implements Profiler {

	private readonly throughput?: string;
	private readonly config?: TimingOptions;

	constructor(config?: TimeProfilerOptions) {
		this.throughput = config?.throughput;
		this.config = config;

		// Verify the config.
		ExecutionTimeMeasurement.normalize(config);
	}

	async onStart(ctx: ProfilingContext) {
		// @ts-expect-error
		if (globalThis.crossOriginIsolated === false) {
			await ctx.note("warn", "Context is non-isolated, performance.now() may work in low-precision mode");
		}

		const { throughput } = this;
		ctx.defineMetric(throughput ? {
			key: "throughput",
			format: `{number} ops/${throughput}`,
			lowerIsBetter: false,
			analysis: MetricAnalysis.Statistics,
		} : {
			key: "time",
			format: "{duration.ms}",
			lowerIsBetter: true,
			analysis: MetricAnalysis.Statistics,
		});
	}

	async onCase(ctx: ProfilingContext, case_: BenchCase, metrics: Metrics) {
		const { throughput, config } = this;
		const measurement = new ExecutionTimeMeasurement(ctx, case_, config);
		const time = await measurement.run();

		if (!throughput) {
			metrics.time = time;
		} else if (time.length > 1 || time[0] !== 0) {
			const d = durationFmt.getFraction(throughput, "ms");
			metrics.throughput = time.map(ms => Math.round(d / ms));
		}
	}
}
