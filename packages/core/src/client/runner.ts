import { Awaitable, cartesianObject, noop } from "@kaciras/utilities/browser";
import { BaselineOptions, BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ExecutionValidator } from "./validate.js";
import { TimeProfiler } from "./time.js";
import { BUILTIN_FIELDS, checkParams, consoleLogHandler, runFns, toDisplayName } from "./utils.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type LogHandler = (level: LogLevel, message?: string) => Awaitable<void>;

export interface ProfilingContext {

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

	run(profilers: Profiler[]): Promise<WorkloadResult[][]>;
}

export interface Profiler {

	onSuite?: (ctx: ProfilingContext, suite: BenchmarkSuite) => Awaitable<void>;

	onScene?: (ctx: ProfilingContext, scene: Scene) => Awaitable<void>;

	onCase?: (ctx: ProfilingContext, case_: BenchCase, metrics: Metrics) => Awaitable<void>;
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

class DefaultEventLogger implements Profiler {

	private index = 0;

	onSuite(ctx: ProfilingContext, suite: BenchmarkSuite) {
		return ctx.info(`\nSuite: ${suite.name}, ${ctx.sceneCount} scenes.`);
	}

	onScene(ctx: ProfilingContext, scene: Scene) {
		const caseCount = scene.cases.length;
		const { sceneCount } = ctx;

		return caseCount === 0
			? ctx.warn(`\nNo case found from scene #${this.index++}.`)
			: ctx.info(`\nScene ${this.index++} of ${sceneCount}, ${caseCount} cases.`);
	}

	onCase(ctx: ProfilingContext, case_: BenchCase) {
		const { name, isAsync, setupHooks, cleanHooks } = case_;
		const hooks = setupHooks.length + cleanHooks.length > 0;
		return ctx.info(`\nCase: ${name} (Async=${isAsync}, InvocationHooks=${hooks})`);
	}
}

async function runHooks<K extends keyof Profiler>(
	profilers: Profiler[],
	name: K,
	...args: Parameters<NonNullable<Profiler[K]>>
) {
	for (const profiler of profilers) {
		// @ts-expect-error Is it a TypeScript bug?
		await profiler[name]?.(...args);
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

	const profilers: Profiler[] = [new DefaultEventLogger()];
	if (validate) {
		profilers.push(new ExecutionValidator(validate));
	}
	if (timing !== false) {
		profilers.push(new TimeProfiler(timing === true ? {} : timing));
	}

	const { length, paramDef } = checkParams(params);

	const ctx: ProfilingContext = {
		sceneCount: length,
		run: newWorkflow,
		warn: message => log("warn", message),
		info: message => log("info", message),
		debug: message => log("debug", message),
	};

	async function newWorkflow(profilers: Profiler[]) {
		const scenes: WorkloadResult[][] = [];
		await runHooks(profilers, "onSuite", ctx, suite);
		for (const comb of cartesianObject(params)) {
			const scene = new Scene(comb, pattern);
			await setup(scene);
			try {
				await runHooks(profilers, "onScene", ctx, scene);

				const workloads: WorkloadResult[] = [];
				scenes.push(workloads);

				for (const case_ of scene.cases) {
					const metrics: Metrics = {};
					await runHooks(profilers, "onCase", ctx, case_, metrics);
					workloads.push({ name: case_.name, metrics });
				}
			} finally {
				await runFns(scene.cleanEach);
			}
		}
		return scenes;
	}

	const scenes = await newWorkflow(profilers).finally(afterAll);

	return { name, baseline, paramDef, scenes } as RunSuiteResult;
}

export type ClientMessage = RunSuiteResult | {
	log?: string;
	level: LogLevel;
};

/**
 * A function that load benchmark suites. Provided by builders.
 */
export type Importer = (path: string) => Awaitable<{ default: BenchmarkSuite }>;

/**
 * A function that post messages to the host. Provided by executors.
 */
export type Channel = (message: ClientMessage) => Awaitable<void>;

export async function connect(channel: Channel, importer: Importer, files: string[], regex?: string) {
	const option: RunSuiteOption = {
		log: (level, log) => channel({ level: level, log }),
		pattern: regex ? new RegExp(regex) : undefined,
	};

	try {
		for (const file of files) {
			const { default: suite } = await importer(file);
			channel(await runSuite(suite, option));
		}
	} catch (e) {
		channel({ log: `Suite execution failed: ${e.message}`, level: "error" });
	}
}
