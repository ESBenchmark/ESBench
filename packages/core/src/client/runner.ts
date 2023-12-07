import { Awaitable, cartesianObject, noop } from "@kaciras/utilities/browser";
import { BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ValidateWorker } from "./validate.js";
import { TimeWorker } from "./time.js";
import { consoleLogHandler, process, runHooks } from "./utils.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * A function that intercepts log messages. If not supplied, logs are printed to the console.
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type LogHandler = (level: LogLevel, message?: string) => Awaitable<void>;

/**
 * A function that intercepts log messages. If not supplied, logs are printed to the console.
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export interface Logger {

	warn(message?: string): Awaitable<void>;

	info(message?: string): Awaitable<void>;

	debug(message?: string): Awaitable<void>;
}

export interface WorkerContext extends Logger {

	run(workers: BenchmarkWorker[]): Promise<void>;
}

export interface BenchmarkWorker {

	onSuite?: (ctx: WorkerContext) => Awaitable<void>;

	onScene?: (ctx: WorkerContext, scene: Scene) => Awaitable<void>;

	onCase?: (ctx: WorkerContext, case_: BenchCase, metrics: Metrics) => Awaitable<void>;
}


export interface WorkloadResult {
	name: string;
	metrics: Metrics;
}

export type Metrics = Record<string, any[]>;

export interface RunSuiteResult {
	name: string;
	paramDef: Record<string, string[]>;
	scenes: WorkloadResult[][];
}

export interface RunSuiteOption {
	log?: LogHandler;
	pattern?: RegExp;
}

export async function runSuite(suite: BenchmarkSuite<any>, options: RunSuiteOption) {
	const { name, setup, afterAll = noop, config = {}, params = {} } = suite;
	const log = options.log ?? consoleLogHandler;
	const pattern = options.pattern ?? new RegExp("");

	const workers: BenchmarkWorker[] = [];

	workers.push(new TimeWorker(config));
	if (config.validate) {
		workers.push(new ValidateWorker(config.validate));
	}

	const { length, paramDef } = process(params);
	const scenes: WorkloadResult[][] = [];

	const ctx: WorkerContext = {
		run: newWorkflow,
		warn: message => log("warn", message),
		info: message => log("info", message),
		debug: message => log("debug", message),
	};

	async function newWorkflow(workers: BenchmarkWorker[]) {
		for (const worker of workers) {
			await worker.onSuite?.(ctx);
		}
		for (const comb of cartesianObject(params)) {
			const scene = new Scene(comb, pattern);
			await setup(scene);
			try {
				for (const worker of workers) {
					await worker.onScene?.(ctx, scene);
				}
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
			await ctx.warn(`\nNo workload found from scene #${index}.`);
		} else {
			await ctx.info(`\nScene ${index} of ${length}, ${caseCount} workloads.`);
		}

		for (const case_ of scene.cases) {
			const metrics: Metrics = {};
			for (const worker of workers) {
				await worker.onCase?.(ctx, case_, metrics);
			}
			workloads.push({ name: case_.name, metrics });
		}
	}

	await newWorkflow(workers).finally(afterAll);

	return { name, paramDef, scenes } as RunSuiteResult;
}
