import { Awaitable, durationFmt, noop } from "@kaciras/utilities/browser";
import { median } from "simple-statistics";
import { BenchCase, SuiteConfig } from "./suite.js";
import { BenchmarkWorker, Metrics, WorkerContext } from "./runner.js";
import { runHooks, timeDetail } from "./utils.js";

type IterateFn = (count: number) => Awaitable<number>;

function unroll(count: number) {
	const body = new Array(count).fill("f()");
	return new Function("f", body.join("\n"));
}

function createInvoker(case_: BenchCase, factor: number): IterateFn {
	let { fn, isAsync, setupHooks, cleanHooks } = case_;

	fn = unroll(factor).bind(null, fn);

	async function asyncNoSetup(count: number) {
		const start = performance.now();
		while (count-- > 0) await fn();
		return performance.now() - start;
	}

	function syncNoSetup(count: number) {
		const start = performance.now();
		while (count-- > 0) fn();
		return performance.now() - start;
	}

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
		return isAsync ? asyncNoSetup : syncNoSetup;
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
		const overhead = median(overheadTimes);

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
