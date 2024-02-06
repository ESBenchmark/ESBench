import { Awaitable, noop } from "@kaciras/utilities/browser";
import { BaselineOptions, BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ExecutionValidator } from "./validate.js";
import { TimeProfiler } from "./time.js";
import { BUILTIN_VARS, checkParams, toDisplayName } from "./utils.js";
import { CaseResult, LogHandler, LogLevel, MetricsMeta, Note, Profiler, ProfilingContext } from "./context.js";

class DefaultEventLogger implements Profiler {

	private index = 0;

	onStart(ctx: ProfilingContext) {
		return ctx.info(`\nSuite: ${ctx.suite.name}, ${ctx.sceneCount} scenes.`);
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

export interface RunSuiteResult {
	name: string;
	paramDef: Array<[string, string[]]>;
	meta: Record<string, MetricsMeta>;
	notes: Note[];
	scenes: CaseResult[][];
	baseline?: BaselineOptions;
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

export async function runSuite(suite: BenchmarkSuite, options: RunSuiteOption = {}) {
	const { name, afterAll = noop, timing = {}, validate, params = {}, baseline } = suite;

	if (baseline) {
		if (!BUILTIN_VARS.includes(baseline.type)) {
			baseline.value = toDisplayName(baseline.value);
		}
	}

	const profilers: Profiler[] = [new DefaultEventLogger()];
	if (suite.profilers) {
		profilers.push(...suite.profilers);
	}
	if (validate) {
		profilers.push(new ExecutionValidator(validate));
	}
	if (timing !== false) {
		profilers.push(new TimeProfiler(timing === true ? {} : timing));
	}

	const paramDef = checkParams(params);
	const context = new ProfilingContext(suite, profilers, options);

	await context.run().finally(afterAll);

	const { scenes, notes, meta } = context;
	return { name, notes, meta, baseline, paramDef, scenes } as RunSuiteResult;
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
		channel({ level: "error", log: `Suite execution failed: ${e.message}` });
	}
}
