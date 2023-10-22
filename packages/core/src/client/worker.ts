import { Awaitable, cartesianObject, CPSrcObject, durationFmt, ellipsis } from "@kaciras/utilities/browser";
import { BenchmarkCase, BenchmarkModule, HookFn, Scene } from "./suite.js";

function toDisplay(v: unknown, i: number) {
	switch (typeof v) {
		case "object":
			return v === null ? "null" : `object #${i}`;
		case "symbol":
			return v.description
				? `symbol(${ellipsis(v.description, 10)}) #${i}`
				: `symbol #${i}`;
		case "function":
			return `func ${ellipsis(v.name, 10)} #${i}`;
		default:
			return ellipsis("" + v, 16) + `#${i}`;
	}
}

function serializable(params: CPSrcObject) {
	const entries = Object.entries(params);
	const processed: Record<string, string[]> = {};
	let length = 0;
	let current: string[];

	for (let i = 0; i < entries.length; i++) {
		const [key, values] = entries[i];
		processed[key] = current = [];

		for (const v of values) {
			const k = current.length;
			current.push(toDisplay(v, k));
		}

		length += current.length;
	}

	return { length, processed };
}

type IterateFn = (count: number) => Awaitable<number>;

function runHooks(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

function createRunner(ctx: Scene, case_: BenchmarkCase) {
	const { workload, isAsync } = case_;
	const { setupIteration, cleanIteration } = ctx;

	async function noSetup(count: number) {
		const start = performance.now();
		if (isAsync) {
			while (count-- > 0) await workload();
		} else {
			while (count-- > 0) workload();
		}
		return performance.now() - start;
	}

	async function syncWithSetup(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runHooks(setupIteration);

			timeUsage -= performance.now();
			workload();
			timeUsage += performance.now();

			await runHooks(cleanIteration);
		}
		return timeUsage;
	}

	async function asyncWithSetup(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runHooks(setupIteration);

			timeUsage -= performance.now();
			await workload();
			timeUsage += performance.now();

			await runHooks(cleanIteration);
		}
		return timeUsage;
	}

	const setup = setupIteration.length && cleanIteration.length;
	return setup ? isAsync ? asyncWithSetup : syncWithSetup : noSetup;
}

async function getIterations(fn: IterateFn, targetMS: number) {
	let count = 1;
	let time = 0;

	while (time < targetMS) {
		time = await fn(count);
		console.log(`Pilot: ${count} op, ${time.toFixed(2)} ms`);
		count *= 2;
	}
	return Math.ceil(count / 2 * targetMS / time);
}

type ParamDefs = Record<string, any[]>;
export type Metrics = Record<string, any[]>;

type WorkloadResult = [string, Metrics];

export type SuiteResult = {
	paramDef: ParamDefs;
	scenes: WorkloadResult[][];
};

type Logger = (message: string) => void;

export class SuiteRunner {

	private readonly suite: BenchmarkModule<any>;
	private readonly logger: Logger;

	constructor(suite: BenchmarkModule<any>, logger: Logger = console.log) {
		this.suite = suite;
		this.logger = logger;
	}

	async run(name?: string): Promise<SuiteResult> {
		const { params = {}, main } = this.suite;
		const scenes: WorkloadResult[][] = [];
		const x = serializable(params);

		let index = 0;
		for (const config of cartesianObject(params)) {
			const scene = new Scene();
			const result: WorkloadResult[] = [];

			await main(scene, config);

			this.logger(`Scene ${++index} of ${x.length}, `
				+ `${scene.cases.length} workloads found`);

			for (const case_ of scene.cases) {
				if (name && case_.name !== name) {
					continue;
				}
				result.push(await this.runWorkload(scene, case_));
			}

			scenes.push(result);
			await runHooks(scene.cleanEach);
		}

		return { paramDef: x.processed, scenes };
	}

	private async runWorkload(scene: Scene, case_: BenchmarkCase) {
		const { samples = 5, iterations = 10_000 } = this.suite.options ?? {};
		const { name } = case_;

		const runFn = createRunner(scene, case_);

		// noinspection SuspiciousTypeOfGuard (false positive)
		const count = typeof iterations === "number"
			? iterations
			: await getIterations(runFn, durationFmt.parse(iterations, "ms"));

		this.logger(`Iterations of ${name}: ${count}\n`);

		const metrics: Metrics = { time: [] };
		for (let i = 0; i < samples; i++) {
			const time = await runFn(count);
			metrics.time.push(time);

			const one = time / count;
			this.logger(`Sample ${i}, ${durationFmt.formatDiv(time, "ms")}, ${durationFmt.formatDiv(one, "ms")}/op`);
		}

		return [name, metrics] as WorkloadResult;
	}
}
