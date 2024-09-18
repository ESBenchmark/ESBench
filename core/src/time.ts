import { medianSorted } from "simple-statistics";
import { AsyncFunction, asyncNoop, Awaitable, durationFmt, noop } from "@kaciras/utilities/browser";
import { welchTest } from "./math.js";
import { BenchCase } from "./suite.js";
import { runFns } from "./utils.js";
import { MetricAnalysis, Metrics, Profiler, ProfilingContext } from "./profiling.js";

interface Iterator {
	invocations: number;
	loops: number;
	calls: number;
	iterate: () => Awaitable<number>;
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
function createIterator(case_: BenchCase, factor: number, loops: number) {
	const { fn, isAsync, beforeHooks, afterHooks } = case_;
	let calls = factor;
	let iterate: Iterator["iterate"];

	if (beforeHooks.length | afterHooks.length) {
		const modifier = isAsync ? "await " : "";

		const template = new AsyncFunction("runFns", "before", "after", `\
			let timeUsage = 0;
			let count = ${loops * factor};
			
			while (count--) {
				await runFns(before);
				timeUsage -= performance.now();
				${modifier}this();
				timeUsage += performance.now();
				await runFns(after);
			}
			return timeUsage;
		`);

		iterate = template.bind(fn, runFns, beforeHooks, afterHooks);
	} else {
		// See examples/self/loop-unrolling.ts for the validity of unrolling.
		const [call, FunctionType, runs] = isAsync
			? ["await this()\n", AsyncFunction, 1]
			: ["this()\n", Function, factor];

		const template = new FunctionType(`\
			const start = performance.now();
			let count = ${loops};
			while (count--) {
				${call.repeat(runs)}
			}
			return performance.now() - start;
		`);

		[calls, iterate] = [runs, template.bind(fn)];
	}

	return { iterate, calls, loops, invocations: calls * loops } as Iterator;
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
	 * Number of iterations for one sample, the larger the result the more accurate and slower it is.
	 *
	 * If is a duration string, it used by Pilot stage to estimate the number of invocations
	 * such that the duration of a sample (including iteration hooks) is close to the given value.
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
 *         await measurement.run();
 *         ctx.info(`Samples: [${measurement.values.join(", ")}]`);
 *     },
 * }
 */
export class ExecutionTimeMeasurement {

	private readonly ctx: ProfilingContext;
	private readonly benchCase: BenchCase;
	private readonly options: Required<TimingOptions>;

	private stage?: string;
	private stageRuns = 0;

	/**
	 * After running, it is the number of runs needed for the benchmark case
	 * to reach the `options.iterations` time.
	 *
	 * If `options.iterations` is a number, the value is equal to it.
	 */
	invocations = NaN;

	/**
	 * After running, it is the number of the loop is unrolled during the measurement.
	 */
	unrollCalls = NaN;

	/**
	 * Samples of benchmark function running time.
	 */
	values: number[] = [];

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
		const { samples, iterations, unrollFactor, evaluateOverhead } = options;
		let iterator: Iterator;

		if (typeof iterations === "string") {
			iterator = await this.estimate(iterations);
			await ctx.info();
		} else {
			const loops = iterations / unrollFactor;
			iterator = createIterator(benchCase, unrollFactor, loops);
		}

		this.invocations = iterator.invocations;
		this.unrollCalls = iterator.calls;
		this.values = await this.measure("Actual", iterator);

		if (evaluateOverhead && samples > 1) {
			await ctx.info();
			await this.subtractOverhead(iterator);
		}

		/*
		 * Previously we were returning `values`, but now we're setting
		 * it to properties because we want to export more information.
		 *
		 * Return an object is ok, but properties is one less allocation :)
		 */
	}

	async subtractOverhead(iterator: Iterator) {
		const { benchCase, ctx, values } = this;
		const overheads = await this.measureOverhead(iterator);

		if (welchTest(values, overheads, "greater") < 0.05) {
			const overhead = medianSorted(overheads);
			for (let i = 0; i < values.length; i++) {
				values[i] -= overhead;
			}
		} else {
			values.length = 1;
			values[0] = 0;
			ctx.note("warn",
				"The function duration is indistinguishable from the empty function duration.", benchCase);
		}
	}

	async measureOverhead({ calls, loops }: Iterator) {
		const { benchCase } = this;

		const fn = benchCase.fn.constructor === Function ? noop : asyncNoop;
		const c = benchCase.derive(benchCase.isAsync, fn);

		return this.measure("Overhead", createIterator(c, calls, loops));
	}

	/*
	 * Modified from BenchmarkDotNet's `EnginePilotStage.RunSpecific()`, the project also
	 * has a `RunAuto()`, but it requires clock resolution, and JS has no API to get it.
	 *
	 * References:
	 * https://github.com/bheisler/criterion.rs/blob/f1ea31a92ff919a455f36b13c9a45fd74559d0fe/src/routine.rs#L82
	 * https://github.com/dotnet/BenchmarkDotNet/blob/6a7244d76082f098a19785e4e3b0e0f269fed004/src/BenchmarkDotNet/Engines/EnginePilotStage.cs#L106
	 */
	async estimate(target: string) {
		const { options: { unrollFactor }, benchCase } = this;

		const targetMS = durationFmt.parse(target, "ms");
		if (targetMS <= 0) {
			throw new Error("Iteration time must be > 0");
		}

		// Make a rough estimate before unrolling, avoid exceeding the target.
		let unrolled = false;
		let count = 1;
		let calls = 1;
		let downCount = 0;

		while (count < Number.MAX_SAFE_INTEGER) {
			const iterator = createIterator(benchCase, calls, Math.round(count));

			// Timing the outer to include iteration hooks.
			const start = performance.now();
			await iterator.iterate();
			const time = performance.now() - start;
			await this.logStageRun("Pilot", time, iterator.invocations);

			if (time === 0) {
				count *= 8;
				continue; // Less than the precision, re-run with larger count.
			}

			const previous = count;
			count = Math.max(1, count * targetMS / time);

			/*
			 * If the workload runs very fast, the first estimate may
			 * not be accurate, so limit it grows to avoid overlarge value.
			 */
			if (previous === 1) {
				count = Math.min(count, 10000);
			}

			// Unroll it after enough count to keep the time stable.
			if (!unrolled && count > unrollFactor * 100) {
				unrolled = true;
				calls = unrollFactor;
				count = count / calls;
			}

			if (
				Math.abs(previous - count) < iterator.calls
				|| count < previous && ++downCount >= 3
			) {
				return iterator;
			}
		}
		throw new Error("Iteration time is too long and the fn runs too fast");
	}

	async measure(name: string, iterator: Iterator) {
		const { ctx } = this;
		const { warmup, samples } = this.options;

		const timeUsageList = new Array<number>(samples);
		const n = iterator.invocations;

		for (let i = 0; i < warmup; i++) {
			const time = await iterator.iterate();
			await this.logStageRun(`${name} Warmup`, time, n);
		}

		await ctx.info();

		for (let i = 0; i < samples; i++) {
			const time = await iterator.iterate();
			timeUsageList[i] = time / n;
			await this.logStageRun(name, time, n);
		}

		return timeUsageList.sort((a, b) => a - b);
	}

	private logStageRun(name: string, timeMS: number, ops: number) {
		if (this.stage !== name) {
			this.stage = name;
			this.stageRuns = 0;
		}
		const mean = durationFmt.formatDiv(timeMS / ops, "ms");
		const t = durationFmt.formatDiv(timeMS, "ms");
		const i = (this.stageRuns++).toString().padStart(2);

		return this.ctx.info(`${name} ${i}: ${ops} operations, ${t}, ${mean}/op`);
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
		await measurement.run();
		const time = measurement.values;

		if (!throughput) {
			metrics.time = time;
		} else if (time.length > 1 || time[0] !== 0) {
			const d = durationFmt.getFraction(throughput, "ms");
			metrics.throughput = time.map(ms => d / ms);
		}
	}
}
