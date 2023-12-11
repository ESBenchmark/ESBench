import { Awaitable, cartesianObject, noop } from "@kaciras/utilities/browser";
import { BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ValidateWorker } from "./validate.js";
import { TimeWorker } from "./time.js";
import { checkParams, consoleLogHandler, runHooks } from "./utils.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type LogHandler = (level: LogLevel, message?: string) => Awaitable<void>;

export interface WorkerContext {

	/**
	 * Using this method will generate warnings, which are logs with log level "warn".
	 */
	warn(message?: string): Awaitable<void>;

	/**
	 * Generate an "info" log. As these logs are displayed by default, use them for information
	 * that is not a warning but makes sense to display to all users on every build.
	 */
	info(message?: string): Awaitable<void>;

	debug(message?: string): Awaitable<void>;

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
	/**
	 * A function that intercepts log messages.
	 * If not supplied, logs are printed to the console.
	 */
	log?: LogHandler;

	/**
	 * Run benchmark with names matching the Regex pattern.
	 */
	pattern?: RegExp;
}

export async function runSuite(suite: BenchmarkSuite<any>, options: RunSuiteOption) {
	const { name, setup, afterAll = noop, timing = {}, validate, params = {} } = suite;
	const log = options.log ?? consoleLogHandler;
	const pattern = options.pattern ?? new RegExp("");

	const workers: BenchmarkWorker[] = [];

	if (timing !== false) {
		workers.push(new TimeWorker(timing === true ? {} : timing));
	}
	if (validate) {
		workers.push(new ValidateWorker(validate));
	}

	const { length, paramDef } = checkParams(params);
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
