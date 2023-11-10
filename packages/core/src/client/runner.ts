import { Awaitable, cartesianObject, noop } from "@kaciras/utilities/browser";
import { BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ValidateWorker } from "./validate.js";
import { TimeWorker } from "./time.js";
import { process, runHooks } from "./utils.js";
import { Metrics, WorkloadResult } from "./collect.js";

/**
 * A function that intercepts log messages. If not supplied, logs are printed to the console.
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type Logger = (message: string) => Awaitable<void>;

export interface WorkerContext {

	run(workers: Array<Omit<BenchmarkWorker, "onSuite">>): Promise<void>;

	warn(message: string): Awaitable<void>;

	info(message: string): Awaitable<void>;

	debug(message: string): Awaitable<void>;
}

export interface BenchmarkWorker {

	onSuite?: (ctx: WorkerContext) => Awaitable<void>;

	onScene?: (ctx: WorkerContext, scene: Scene) => Awaitable<void>;

	onCase?: (ctx: WorkerContext, case_: BenchCase, metrics: Metrics) => Awaitable<void>;
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

	const workers: BenchmarkWorker[] = [];

	const { validateExecution, validateReturnValue } = config;
	if (validateExecution || validateReturnValue) {
		workers.push(new ValidateWorker(validateReturnValue));
	}

	workers.push(new TimeWorker(config));

	const { length, paramDef } = process(params);
	const scenes: WorkloadResult[][] = [];

	const ctx: WorkerContext = {
		warn: logger,
		info: logger,
		debug: logger,
		run: newWorkflow,
	};

	async function newWorkflow(workers: BenchmarkWorker[]) {
		for (const comb of cartesianObject(params)) {
			const scene = new Scene(pattern);
			await setup(scene, comb);
			try {
				await handleScene(scene, workers);
			} finally {
				await runHooks(scene.cleanEach);
			}
		}
	}

	async function handleScene(scene: Scene, workers: BenchmarkWorker[]) {
		const workloads: WorkloadResult[] = [];
		const caseCount = scene.cases.length;
		const index = scenes.push(workloads);

		if (caseCount === 0) {
			await logger(`\nWarning: No workload found from scene #${index}.`);
		} else {
			await logger(`\nScene ${index} of ${length}, ${caseCount} workloads.`);
		}

		for (const worker of workers) {
			await worker.onScene?.(ctx, scene);
		}

		for (const case_ of scene.cases) {
			const metrics: Metrics = {};
			for (const worker of workers) {
				await worker.onCase?.(ctx, case_, metrics);
			}
			workloads.push({ name: case_.name, metrics });
		}
	}

	for (const worker of workers) {
		await worker.onSuite?.(ctx);
	}

	await newWorkflow(workers);
	await afterAll();

	return { name, paramDef, scenes } as RunSuiteResult;
}
