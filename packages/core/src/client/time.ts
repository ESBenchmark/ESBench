import { AsyncFunction, Awaitable, durationFmt, noop } from "@kaciras/utilities/browser";
import { medianSorted } from "simple-statistics";
import { BenchCase } from "./suite.js";
import { Profiler, ProfilingContext, Recorder } from "./runner.js";
import { runFns, timeDetail } from "./utils.js";
import { welchTest } from "./math.js";

type Iterate = (count: number) => Awaitable<number>;

const asyncNoop = async () => {};

function unroll(factor: number, isAsync: boolean) {
	const call = isAsync ? "await f()" : "f()";
	const body = `\
		const start = performance.now();
		while (count--) {
			${new Array(factor).fill(call).join("\n")}
		}
		return performance.now() - start;
	`;
	return new AsyncFunction("f", "count", body);
}

/*
 * One idea is treat iteration hooks as overhead, run them with an empty benchmark,
 * then minus the time from result.
 * but this cannot handle some cases. for example, consider the code:
 *
 * let data = null;
 * scene.bench("foo", () => data = create());
 * scene.afterIteration(() => {
 *     if (data) heavyCleanup(data);
 * });
 *
 * If we replace the benchmark function with `noop`, `heavyCleanup` will not be called,
 * we will get a wrong overhead time.
 */

function createInvoker(factor: number, case_: BenchCase): Iterate {
	const { fn, isAsync, setupHooks, cleanHooks } = case_;

	async function syncWithHooks(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runFns(setupHooks);

			timeUsage -= performance.now();
			fn();
			timeUsage += performance.now();

			await runFns(cleanHooks);
		}
		return timeUsage;
	}

	async function asyncWithHooks(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runFns(setupHooks);

			timeUsage -= performance.now();
			await fn();
			timeUsage += performance.now();

			await runFns(cleanHooks);
		}
		return timeUsage;
	}

	if (setupHooks.length | cleanHooks.length) {
		return isAsync ? asyncWithHooks : syncWithHooks;
	} else {
		return unroll(factor, isAsync).bind(null, fn);
	}
}

export interface TimingOptions {

	/**
	 * How many target iterations should be performed.
	 *
	 * @default 10
	 */
	samples?: number;

	/**
	 * How many warmup iterations should be performed.
	 * The value can be 0, which disables warmup.
	 *
	 * @default 5
	 */
	warmup?: number;

	/**
	 * how many times the benchmark method will be invoked per one iteration of a generated loop.
	 *
	 * @default 16
	 */
	unrollFactor?: number;

	/**
	 * Invocation count or time in a single iteration.
	 *
	 * If the value is a number it used as invocation count, must be a multiple of unrollFactor.
	 *
	 * It is a duration string, it used by Pilot stage to estimate the number of invocations per iteration.
	 *
	 * @default "1s"
	 */
	iterations?: number | string;
}

export class TimeProfiler implements Profiler {

	private readonly config: TimingOptions;

	constructor(config: TimingOptions) {
		this.config = config;
	}

	async onSuite(ctx: ProfilingContext) {
		// @ts-ignore
		if (globalThis.crossOriginIsolated === false) {
			await ctx.warn("Context is non-isolated, performance.now() may work in low-precision mode. For more details, see:\n" +
				"https://developer.mozilla.org/docs/Web/API/Performance/now#security_requirements");
		}
	}

	async onCase(ctx: ProfilingContext, case_: BenchCase, recorder: Recorder) {
		const { samples = 10, unrollFactor = 16 } = this.config;
		let { iterations = "1s" } = this.config;

		if (unrollFactor < 1) {
			throw new Error("The unrollFactor option must be at least 1.");
		}
		if (samples <= 0) {
			throw new Error("The number of samples must be at least 1.");
		}

		const iterateActual = createInvoker(unrollFactor, case_);

		// noinspection SuspiciousTypeOfGuard
		if (typeof iterations === "string") {
			iterations = await this.estimate(ctx, iterateActual, iterations);
			await ctx.info();
		} else if (iterations % unrollFactor === 0) {
			iterations /= unrollFactor;
		} else {
			throw new Error("iterations must be a multiple of unrollFactor.");
		}

		if (iterations <= 0) {
			throw new Error("The number of iterations cannot be 0 or negative.");
		}

		const iterateOverhead = createInvoker(unrollFactor, <any>{
			fn: case_.fn.constructor === Function ? noop : asyncNoop,
			setupHooks: [],
			cleanHooks: [],
			isAsync: case_.isAsync,
		});

		const overheads = await this.measure(ctx, "Overhead", iterateOverhead, iterations);
		await ctx.info();
		const time = await this.measure(ctx, "Actual", iterateActual, iterations);

		const pValue = welchTTest(time, overheads, "greater");
		if (pValue < 0.05) {
			const overhead = medianSorted(overheads);
			recorder.metrics.time = time.map(ms => ms - overhead);
		} else {
			recorder.metrics.time = [0];
			recorder.note("warn",
				"The function duration is indistinguishable from the empty function duration.", case_);
		}
	}

	async estimate(ctx: ProfilingContext, iterate: Iterate, target: string) {
		const targetMS = durationFmt.parse(target, "ms");

		let iterations = 1;
		let time = 0;
		while (time < targetMS) {
			time = await iterate(iterations);
			await ctx.info(`Pilot: ${timeDetail(time, iterations)}`);
			iterations *= 2;
		}

		return Math.ceil(iterations / 2 * targetMS / time);
	}

	async measure(ctx: ProfilingContext, name: string, iterate: Iterate, count: number) {
		const { warmup = 5, samples = 10 } = this.config;
		const timeUsageList = [];

		for (let i = 0; i < warmup; i++) {
			const time = await iterate(count);
			await ctx.info(`${name} Warmup: ${timeDetail(time, count)}`);
		}

		await ctx.info();

		for (let i = 0; i < samples; i++) {
			const time = await iterate(count);
			timeUsageList.push(time / count);
			await ctx.info(`${name}: ${timeDetail(time, count)}`);
		}

		return timeUsageList.sort((a, b) => a - b);
	}
}
