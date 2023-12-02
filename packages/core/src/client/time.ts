import { AsyncFunction, Awaitable, durationFmt, noop } from "@kaciras/utilities/browser";
import { medianSorted } from "simple-statistics";
import { BenchCase, SuiteConfig } from "./suite.js";
import { BenchmarkWorker, Metrics, WorkerContext } from "./runner.js";
import { runHooks, timeDetail } from "./utils.js";

type IterateFn = (count: number) => Awaitable<number>;

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

function createInvoker(case_: BenchCase, factor: number): IterateFn {
	const { fn, isAsync, setupHooks, cleanHooks } = case_;

	async function syncWithSetup(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runHooks(setupHooks);

			timeUsage -= performance.now();
			fn();
			timeUsage += performance.now();

			await runHooks(cleanHooks);
		}
		return timeUsage;
	}

	async function asyncWithSetup(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runHooks(setupHooks);

			timeUsage -= performance.now();
			await fn();
			timeUsage += performance.now();

			await runHooks(cleanHooks);
		}
		return timeUsage;
	}

	if (setupHooks.length | cleanHooks.length) {
		return isAsync ? asyncWithSetup : syncWithSetup;
	} else {
		return unroll(factor, isAsync).bind(null, fn);
	}
}

export class TimeWorker implements BenchmarkWorker {

	private readonly config: SuiteConfig;

	constructor(config: SuiteConfig) {
		this.config = config;
	}

	async onCase(ctx: WorkerContext, case_: BenchCase, metrics: Metrics) {
		const { warmup = 5, samples = 10, unrollFactor = 16 } = this.config;
		let { iterations = "1s" } = this.config;

		if (unrollFactor < 1) {
			throw new Error("The unrollFactor option must be at least 1.");
		}
		if (samples <= 0) {
			throw new Error("The number of samples must be at least 1.");
		}

		const iterate = createInvoker(case_, unrollFactor);
		await ctx.info(`\nBenchmark: ${case_.name}`);

		// noinspection SuspiciousTypeOfGuard
		if (typeof iterations === "string") {
			iterations = await this.getIterations(iterate, iterations, ctx);
		} else if (iterations % unrollFactor === 0) {
			iterations /= unrollFactor;
		} else {
			throw new Error("iterations must be a multiple of unrollFactor.");
		}

		if (iterations <= 0) {
			throw new Error("The number of iterations cannot be 0 or negative.");
		}

		const iterateOverhead = createInvoker(<any>{
			fn: noop,
			isAsync: case_.isAsync,
			setupHooks: [],
			cleanHooks: [],
		}, unrollFactor);
		const overheadTimes = [];

		for (let i = 0; i < warmup; i++) {
			const time = await iterateOverhead(iterations);
			await ctx.info(`Overhead Warmup: ${timeDetail(time, iterations)}`);
		}

		for (let i = 0; i < samples; i++) {
			const time = await iterateOverhead(iterations);
			overheadTimes.push(time);
			await ctx.info(`Overhead: ${timeDetail(time, iterations)}`);
		}
		const overhead = medianSorted(overheadTimes.sort());

		for (let i = 0; i < warmup; i++) {
			const time = await iterate(iterations);
			await ctx.info(`Actual Warmup: ${timeDetail(time, iterations)}`);
		}

		// noinspection JSMismatchedCollectionQueryUpdate
		const values: number[] = metrics.time = [];
		await ctx.info();

		for (let i = 0; i < samples; i++) {
			const time = await iterate(iterations) - overhead;
			values.push(time / iterations);
			await ctx.info(`Actual: ${timeDetail(time, iterations)}`);
		}
	}

	async getIterations(fn: IterateFn, target: string, ctx: WorkerContext) {
		const targetMS = durationFmt.parse(target, "ms");

		let count = 1;
		let time = 0;
		while (time < targetMS) {
			time = await fn(count);
			await ctx.info(`Pilot: ${timeDetail(time, count)}`);
			count *= 2;
		}

		await ctx.info();
		return Math.ceil(count / 2 * targetMS / time);
	}
}
