import { Awaitable, durationFmt } from "@kaciras/utilities/browser";
import { BenchCase, SuiteConfig } from "./suite.js";
import { BenchmarkWorker, WorkerContext } from "./runner.js";
import { runHooks, timeDetail } from "./utils.js";
import { Metrics } from "./collect.js";

type IterateFn = (count: number) => Awaitable<number>;

function unroll(fn: Workload, count: number) {
	const call = "x = fn()";
	const body = new Array(count).fill(call).join("\n");
	return eval(`() => { let x; ${body}; return x }`);
}

function createInvoker(case_: BenchCase, factor: number): IterateFn {
	let { fn, isAsync, setupHooks, cleanHooks } = case_;

	fn = unroll(fn, factor);

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
		const { warmup = 5, samples = 10, unrollFactor = 16, iterations = "1s" } = this.config;
		const iterate = createInvoker(case_, unrollFactor);
		await ctx.info(`\nBenchmark: ${case_.name}`);

		// noinspection SuspiciousTypeOfGuard (false positive)
		const count = typeof iterations === "number"
			? iterations
			: await this.getIterations(iterate, iterations, ctx);

		if (samples <= 0) {
			throw new Error("The number of samples must be at least 1.");
		}
		if (count <= 0) {
			throw new Error("The number of iterations cannot be 0 or negative.");
		}

		for (let i = 0; i < warmup; i++) {
			const time = await iterate(count);
			await ctx.info(`Wramup: ${timeDetail(time, count)}`);
		}

		// noinspection JSMismatchedCollectionQueryUpdate
		const values: number[] = metrics.time = [];
		await ctx.info("");

		for (let i = 0; i < samples; i++) {
			const time = await iterate(count);
			values.push(time / count);
			await ctx.info(`Actual: ${timeDetail(time, count)}`);
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

		await ctx.info("");
		return Math.ceil(count / 2 * targetMS / time);
	}
}
