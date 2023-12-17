import { Awaitable, cartesianObject, noop } from "@kaciras/utilities/browser";
import { BaselineOptions, BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ValidateWorker } from "./validate.js";
import { TimeWorker } from "./time.js";
import { BUILTIN_FIELDS, checkParams, consoleLogHandler, runFns, toDisplayName } from "./utils.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type LogHandler = (level: LogLevel, message?: string) => Awaitable<void>;

export interface WorkerContext {

	sceneCount: number;

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

	onSuite?: (ctx: WorkerContext, suite: BenchmarkSuite) => Awaitable<void>;

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
	baseline?: BaselineOptions;
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

class DefaultLoggingWorker implements BenchmarkWorker {

	private index = 0;

	onSuite(ctx: WorkerContext, suite: BenchmarkSuite) {
		return ctx.info(`\nSuite: ${suite.name}, ${ctx.sceneCount} scenes.`);
	}

	onScene(ctx: WorkerContext, scene: Scene) {
		const caseCount = scene.cases.length;
		const { sceneCount } = ctx;

		return caseCount === 0
			? ctx.warn(`\nNo case found from scene #${this.index++}.`)
			: ctx.info(`\nScene ${this.index++} of ${sceneCount}, ${caseCount} cases.`);
	}

	onCase(ctx: WorkerContext, case_: BenchCase) {
		const { name, isAsync, setupHooks, cleanHooks } = case_;
		const hooks = setupHooks.length + cleanHooks.length > 0;
		return ctx.info(`\nCase: ${name} (Async=${isAsync}, InvocationHooks=${hooks})`);
	}
}

async function runHooks<K extends keyof BenchmarkWorker>(
	workers: BenchmarkWorker[],
	name: K,
	...args: Parameters<NonNullable<BenchmarkWorker[K]>>
) {
	for (const worker of workers) {
		// @ts-expect-error Is it a TypeScript bug?
		await worker[name]?.(...args);
	}
}

export async function runSuite(suite: BenchmarkSuite, options: RunSuiteOption) {
	const { name, setup, afterAll = noop, timing = {}, validate, params = {}, baseline } = suite;
	const log = options.log ?? consoleLogHandler;
	const pattern = options.pattern ?? new RegExp("");

	if (baseline) {
		if (!BUILTIN_FIELDS.includes(baseline.type)) {
			baseline.value = toDisplayName(baseline.value);
		}
	}

	const workers: BenchmarkWorker[] = [new DefaultLoggingWorker()];
	if (validate) {
		workers.push(new ValidateWorker(validate));
	}
	if (timing !== false) {
		workers.push(new TimeWorker(timing === true ? {} : timing));
	}

	const { length, paramDef } = checkParams(params);
	const scenes: WorkloadResult[][] = [];

	const ctx: WorkerContext = {
		sceneCount: length,
		run: newWorkflow,
		warn: message => log("warn", message),
		info: message => log("info", message),
		debug: message => log("debug", message),
	};

	async function newWorkflow(workers: BenchmarkWorker[]) {
		await runHooks(workers, "onSuite", ctx, suite);
		for (const comb of cartesianObject(params)) {
			const scene = new Scene(comb, pattern);
			await setup(scene);
			try {
				await runHooks(workers, "onScene", ctx, scene);
				await handleScene(scene, workers);
			} finally {
				await runFns(scene.cleanEach);
			}
		}
	}

	async function handleScene(scene: Scene, workers: BenchmarkWorker[]) {
		const workloads: WorkloadResult[] = [];
		scenes.push(workloads);

		for (const case_ of scene.cases) {
			const metrics: Metrics = {};
			await runHooks(workers, "onCase", ctx, case_, metrics);
			workloads.push({ name: case_.name, metrics });
		}
	}

	await newWorkflow(workers).finally(afterAll);

	return { name, baseline, paramDef, scenes } as RunSuiteResult;
}
