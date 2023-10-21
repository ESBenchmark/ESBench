import { Awaitable, cartesianObject, CPSrcObject, durationFmt, ellipsis } from "@kaciras/utilities/browser";
import { BenchmarkCase, BenchmarkModule, HookFn, Scene } from "./suite.js";

function serializable(params: CPSrcObject) {
	const entries = Object.entries(params);
	const processed: Record<string, any[]> = {};
	const counters = new Array(entries.length).fill(0);

	let current: any[];

	for (let i = 0; i < entries.length; i++) {
		const [key, values] = entries[i];
		processed[key] = current = [];

		for (const v of values) {
			const k = counters[i]++;
			switch (typeof v) {
				case "object":
					current.push(v === null ? "null" : `object #${k}`);
					break;
				case "symbol":
					current.push(v.description
						? `symbol(${ellipsis(v.description, 10)}) #${k}`
						: `symbol #${k}`,
					);
					break;
				case "function":
					current.push(`func ${ellipsis(v.name, 10)} #${k}`);
					break;
				default:
					current.push(ellipsis("" + v, 16));
			}
		}
	}

	return processed;
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

		let index = 0;
		for (const config of cartesianObject(params)) {
			const scene = new Scene();
			const result: WorkloadResult[] = [];

			await main(scene, config);
			this.logger(`Scene ${index++}, ${scene.benchmarks.length} workloads found`);

			for (const case_ of scene.benchmarks) {
				if (name && case_.name !== name) {
					continue;
				}
				result.push(await this.runWorkload(scene, case_));
			}

			scenes.push(result);
			await runHooks(scene.cleanEach);
		}

		return { paramDef: serializable(params), scenes };
	}

	private async runWorkload(context: Scene, case_: BenchmarkCase) {
		const { samples = 5, iterations = 10_000 } = this.suite.options ?? {};
		const { name } = case_;

		const runFn = createRunner(context, case_);

		// noinspection SuspiciousTypeOfGuard (false positive)
		const count = typeof iterations === "number"
			? iterations
			: await getIterations(runFn, durationFmt.parse(iterations, "ms"));

		console.log("Count:" + count);

		const metrics: Metrics = { time: [] };
		for (let i = 0; i < samples; i++) {
			metrics.time.push(await runFn(count));
		}

		return [name, metrics] as WorkloadResult;
	}
}
