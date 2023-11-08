import { Awaitable, cartesianObject, durationFmt, noop } from "@kaciras/utilities/browser";
import { BenchmarkCase, BenchmarkSuite, EqualityFn, HookFn, Scene, SuiteConfig } from "./suite.js";
import { serializable, timeDetail } from "./message.js";
import { Metrics, WorkloadResult } from "./collect.js";

type IterateFn = (count: number) => Awaitable<number>;

function runHooks(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

function createInvoker(ctx: Scene, case_: BenchmarkCase) {
	const { workload, isAsync } = case_;
	const { setupIteration, cleanIteration } = ctx;

	async function invoke() {
		await runHooks(setupIteration);
		const returnValue = await workload();
		await runHooks(cleanIteration);
		return returnValue;
	}

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
	const iterate: IterateFn = setup
		? isAsync
			? asyncWithSetup : syncWithSetup : noSetup;

	return { run: invoke, iterate, name: case_.name };
}

/**
 * A function that intercepts log messages. If not supplied, logs are printed to the console.
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
type Logger = (message: string) => Awaitable<void>;

export interface BenchmarkWorker {

	onScene(scene: Scene): Awaitable<void>;

	onCase(scene: Scene, case_: BenchmarkCase): Awaitable<void>;
}

class Validator implements BenchmarkWorker {

	private static NONE = Symbol();

	private readonly isEqual: EqualityFn;

	private value: any = Validator.NONE;

	constructor(option?: boolean | EqualityFn) {
		if (option === true) {
			this.isEqual = (a, b) => a === b;
		} else if (option) {
			this.isEqual = option;
		} else {
			this.isEqual = () => true;
		}
	}

	onScene = noop;

	async onCase(scene: Scene, case_: BenchmarkCase) {
		const { value, isEqual } = this;
		const { run } = createInvoker(scene, case_);

		const current = await run();

		if (value === Validator.NONE) {
			this.value = current;
		} else if (!isEqual(value, current)) {
			const { name } = scene.cases[0];
			throw new Error(`${case_.name} and ${name} returns different value.`);
		}
	}
}

class WorkloadRunner implements BenchmarkWorker {

	private readonly config: SuiteConfig;
	private readonly logger: Logger;
	private readonly total: number;

	result: WorkloadResult[][] = [];
	sceneRecords: WorkloadResult[] = [];

	constructor(config: SuiteConfig, logger: Logger, total: number) {
		this.config = config;
		this.logger = logger;
		this.total = total;
	}

	async onScene(scene: Scene) {
		const { result, logger, total } = this;
		const { length } = scene.cases;

		const x = this.sceneRecords = [];
		const index = result.push(x);

		if (length === 0) {
			await logger(`\nWarning: No workload found from scene #${index}.`);
		} else {
			await logger(`\nScene ${index} of ${total}, ${length} workloads.`);
		}
	}

	async onCase(scene: Scene, case_: BenchmarkCase) {
		const { warmup = 5, samples = 10, iterations = "1s" } = this.config;
		const { iterate } = createInvoker(scene, case_);
		await this.logger(`\nBenchmark: ${case_.name}`);

		// noinspection SuspiciousTypeOfGuard (false positive)
		const count = typeof iterations === "number"
			? iterations
			: await this.getIterations(iterate, iterations);

		if (samples <= 0) {
			throw new Error("The number of samples must be at least 1.");
		}
		if (count <= 0) {
			throw new Error("The number of iterations cannot be 0 or negative.");
		}

		for (let i = 0; i < warmup; i++) {
			const time = await iterate(count);
			await this.logger(`Wramup: ${timeDetail(time, count)}`);
		}

		const metrics: Metrics = { time: [] };
		await this.logger("");

		for (let i = 0; i < samples; i++) {
			const time = await iterate(count);
			metrics.time.push(time);
			await this.logger(`Actual: ${timeDetail(time, count)}`);
		}

		this.sceneRecords.push({ name: case_.name, metrics });
	}

	async getIterations(fn: IterateFn, target: string) {
		const targetMS = durationFmt.parse(target, "ms");

		let count = 1;
		let time = 0;
		while (time < targetMS) {
			time = await fn(count);
			await this.logger(`Pilot: ${timeDetail(time, count)}`);
			count *= 2;
		}

		await this.logger("");
		return Math.ceil(count / 2 * targetMS / time);
	}
}

export interface RunSuiteOption {
	logger?: Logger;
	pattern?: RegExp;
}

export interface RunSuiteResult {
	name: string;
	paramDef: Record<string, string[]>;
	scenes: WorkloadResult[][];
}

export async function runSuite(suite: BenchmarkSuite<any>, options: RunSuiteOption) {
	const { name, setup, afterAll = noop, config = {}, params = {} } = suite;
	const logger = options.logger ?? console.log;
	const pattern = options.pattern ?? new RegExp("");

	async function run(action: BenchmarkWorker) {
		for (const comb of cartesianObject(params)) {
			const scene = new Scene();
			await setup(scene, comb);
			await action.onScene(scene);

			for (const case_ of scene.cases) {
				if (!pattern.test(case_.name)) {
					continue;
				}
				await action.onCase(scene, case_);
			}
			await runHooks(scene.cleanEach);
		}
	}

	const { validateExecution, validateReturnValue } = config;
	if (validateExecution || validateReturnValue) {
		await run(new Validator(validateReturnValue));
	}

	const { length, paramDef } = serializable(params);
	const workloadRunner = new WorkloadRunner(config, logger, length);
	await run(workloadRunner);

	await afterAll();

	return { name, paramDef, scenes: workloadRunner.result } as RunSuiteResult;
}
