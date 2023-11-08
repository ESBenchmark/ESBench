import { Awaitable, cartesianObject, noop } from "@kaciras/utilities/browser";
import { BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { process, runHooks } from "./utils.js";
import { Metrics, WorkloadResult } from "./collect.js";
import { ValidateWorker } from "./validate.js";
import { TimeWorker } from "./time.js";

/**
 * A function that intercepts log messages. If not supplied, logs are printed to the console.
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type Logger = (message: string) => Awaitable<void>;

type HandleScene = (scene: Scene) => Awaitable<void>;

export type ForEachScene = (handler: HandleScene) => Promise<void>;

export interface BenchmarkWorker {

	onSuite?(forEach: ForEachScene, logger: Logger): Awaitable<void>;

	onScene?(scene: Scene, logger: Logger): Awaitable<void>;

	onCase?(case_: BenchCase, metrics: Metrics, logger: Logger): Awaitable<void>;
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

	async function forEachScene(handler: HandleScene) {
		for (const comb of cartesianObject(params)) {
			const scene = new Scene(pattern);
			await setup(scene, comb);
			try {
				await handler(scene);
			} finally {
				await runHooks(scene.cleanEach);
			}
		}
	}

	async function handleScene(scene: Scene) {
		const workloads: WorkloadResult[] = [];
		const caseCount = scene.cases.length;
		const index = scenes.push(workloads);

		if (caseCount === 0) {
			await logger(`\nWarning: No workload found from scene #${index}.`);
		} else {
			await logger(`\nScene ${index} of ${length}, ${caseCount} workloads.`);
		}

		for (const worker of workers) {
			await worker.onScene?.(scene, logger);
		}

		for (const case_ of scene.cases) {
			const metrics: Metrics = {};
			for (const worker of workers) {
				await worker.onCase?.(case_, metrics, logger);
			}
			workloads.push({ name: case_.name, metrics });
		}
	}

	for (const worker of workers) {
		await worker.onSuite?.(forEachScene, logger);
	}

	await forEachScene(handleScene);
	await afterAll();

	return { name, paramDef, scenes } as RunSuiteResult;
}
