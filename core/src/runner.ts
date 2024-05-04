import { CPSrcObject } from "@kaciras/utilities/browser";
import { serializeError } from "serialize-error";
import { BaselineOptions, BenchCase, BenchmarkSuite, Scene, UserSuite } from "./suite.js";
import { ExecutionValidator } from "./validate.js";
import { TimeProfiler } from "./time.js";
import { BUILTIN_VARS, checkParams, toDisplayName } from "./utils.js";
import { LogHandler, MetricMeta, Note, Profiler, ProfilingContext, SceneResult } from "./profiling.js";

class DefaultEventLogger implements Profiler {

	private sceneIndex = 0;
	private caseOfScene = 0;

	onScene(ctx: ProfilingContext, scene: Scene) {
		const caseCount = scene.cases.length;
		const { sceneCount } = ctx;

		this.caseOfScene = 0;
		const i = ++this.sceneIndex;

		return caseCount === 0
			? ctx.warn(`\nNo case found from scene #${i}.`)
			: ctx.info(`\nScene #${i} of ${sceneCount}, ${caseCount} cases.`);
	}

	onCase(ctx: ProfilingContext, case_: BenchCase) {
		const { name, isAsync, beforeHooks, afterHooks } = case_;
		const hooks = beforeHooks.length + afterHooks.length > 0;
		const i = ++this.caseOfScene;
		return ctx.info(`\nCase #${i}: ${name} (Async=${isAsync}, InvocationHooks=${hooks})`);
	}
}

/**
 * Wrap the original error and provide more information.
 * The original error can be retrieved by the cause property.
 */
export class RunSuiteError extends Error {

	/**
	 * The params property of the scene that threw the error.
	 *
	 * This property is not serializable, it will be undefined in the host side.
	 */
	readonly params?: object;

	/** JSON represent of the params */
	readonly paramStr?: string;

	constructor(message: string, cause: Error, params?: object, ps?: string) {
		super(message, { cause });
		this.params = params;
		this.paramStr = ps;
		this.cause = cause; // For compatibility.
	}

	// noinspection JSUnusedGlobalSymbols; Used by serializeError()
	toJSON() {
		const { name, stack, message, paramStr } = this;
		return {
			name, stack, message, paramStr,
			cause: serializeError(this.cause),
		};
	}

	static fromScene(params: object, cause: Error) {
		const p: Record<string, string> = {};
		for (const [k, v] of Object.entries(params)) {
			p[k] = toDisplayName(v);
		}
		const s = JSON.stringify(p);
		const message = "Error occurred in scene " + s;
		return new RunSuiteError(message, cause, params, s);
	}
}

RunSuiteError.prototype.name = "RunSuiteError";

/**
 * `baseline` option of the suite, with `value` transformed to short string.
 */
export interface ResultBaseline {
	type: string;
	value: string;
}

export interface RunSuiteResult {
	scenes: SceneResult[];
	notes: Note[];
	meta: Record<string, MetricMeta>;
	paramDef: Array<[string, string[]]>;
	baseline?: ResultBaseline;
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

function toSuiteOptions(input: UserSuite): BenchmarkSuite {
	return typeof input === "function" ? { setup: input } : input;
}

function resolveProfilers(suite: BenchmarkSuite) {
	const { timing, validate } = suite;

	const resolved: any = [new DefaultEventLogger()];
	if (suite.profilers) {
		resolved.push(...suite.profilers);
	}
	if (validate) {
		resolved.push(new ExecutionValidator(validate));
	}
	if (timing !== false) {
		resolved.push(new TimeProfiler(timing === true ? {} : timing));
	}

	return resolved.filter(Boolean) as Profiler[];
}

function checkBaseline(baseline: BaselineOptions, params: CPSrcObject) {
	const { type, value } = baseline;
	if (BUILTIN_VARS.includes(type)) {
		return;
	}
	const values = params[type];
	if (values && Array.prototype.includes.call(values, value)) {
		baseline.value = toDisplayName(value);
	} else {
		throw new Error(`Baseline (${type}=${value}) does not in params`);
	}
}

/**
 * Run a benchmark suite. Any exception that occur within this function is wrapped with RunSuiteError.
 */
export async function runSuite(suite: UserSuite, options: RunSuiteOption = {}) {
	suite = toSuiteOptions(suite);
	const { beforeAll, afterAll, params = {}, baseline } = suite;

	let context: ProfilingContext | undefined = undefined;
	try {
		const profilers = resolveProfilers(suite);
		if (baseline) {
			checkBaseline(baseline, params);
		}
		const paramDef = checkParams(params);

		context = new ProfilingContext(suite, profilers, options);
		await beforeAll?.();
		await context.run().finally(afterAll);

		const { scenes, notes, meta } = context;
		return { notes, meta, baseline, paramDef, scenes } as RunSuiteResult;
	} catch (e) {
		const wp = (context as any)?.workingParams;
		if (wp) {
			throw RunSuiteError.fromScene(wp, e);
		}
		throw new RunSuiteError("Error occurred when running suite.", e);
	}
}
