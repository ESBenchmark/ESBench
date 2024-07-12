import { cartesianObject } from "@kaciras/utilities/browser";
import { BenchCase, NormalizedSuite, normalizeSuite, Scene, UserSuite } from "./suite.js";
import { ExecutionValidator } from "./validate.js";
import { TimeProfiler } from "./time.js";
import { attrx, BUILTIN_VARS } from "./utils.js";
import { LogHandler, MetricMeta, Note, Profiler, ProfilingContext, SceneResult } from "./profiling.js";

class DefaultEventLogger implements Profiler {

	private paramNamesIter!: Iterator<unknown>;
	private sceneIndex = 0;
	private caseOfScene = 0;

	onStart(ctx: ProfilingContext) {
		this.paramNamesIter = cartesianObject(ctx.suite.paramNames);
	}

	async onScene(ctx: ProfilingContext, scene: Scene) {
		const caseCount = scene.cases.length;
		const sceneCount = ctx.suite.params.reduce((s, v) => s * v.length, 1);

		const i = ++this.sceneIndex;
		this.caseOfScene = 0;

		let paramsText = "no parameters.";
		if (ctx.suite.params.length !== 0) {
			const { value } = this.paramNamesIter.next();
			paramsText = `params: \n${JSON.stringify(value)}`;
		}
		return caseCount === 0
			? ctx.info(`\nNo case found from scene #${i}, ${paramsText}`)
			: ctx.info(`\nScene #${i} of ${sceneCount}, ${caseCount} cases, ${paramsText}`);
	}

	onCase(ctx: ProfilingContext, case_: BenchCase) {
		const { name, isAsync, beforeHooks, afterHooks } = case_;
		const hooks = beforeHooks.length + afterHooks.length > 0;
		const attrs = attrx([
			isAsync ? "Async" : "Sync",
			hooks && "HasHooks",
		]);
		return ctx.info(`\nCase #${++this.caseOfScene}: "${name}"${attrs}`);
	}
}

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
	 * A function that intercepts log messages. If not supplied, logs are printed to the console.
	 */
	log?: LogHandler;

	/**
	 * Run benchmark cases with names matching the Regex pattern.
	 */
	pattern?: RegExp;
}

function resolveProfilers(suite: NormalizedSuite) {
	const { timing, validate } = suite;

	const resolved: any = [new DefaultEventLogger()];
	if (validate) {
		resolved.push(new ExecutionValidator(validate));
	}
	if (timing) {
		resolved.push(new TimeProfiler(timing));
	}
	if (suite.profilers) {
		resolved.push(...suite.profilers);
	}
	return resolved.filter(Boolean) as Profiler[];
}

function convertBaseline({ params, paramNames, baseline }: NormalizedSuite) {
	if (!baseline) {
		return;
	}
	const { type, value } = baseline;

	if (BUILTIN_VARS.includes(type)) {
		if (typeof value !== "string") {
			throw new Error(`Value of baseline (${type}) must be a string`);
		}
		return baseline as ResultBaseline;
	}

	const i = params.findIndex(e => e[0] === type);
	if (i === -1) {
		throw new Error(`Baseline (${type}) does not in params`);
	}

	const k = params[i][1].indexOf(value);
	if (k !== -1) {
		return { type, value: paramNames[i][1][k] };
	}
	throw new Error(`Baseline value (${value}) does not in params[${type}]`);
}

/**
 * Run a benchmark suite.
 *
 * @see https://esbench.vercel.app/api/runner
 */
export async function runSuite(userSuite: UserSuite, options: RunSuiteOption = {}) {
	const suite = normalizeSuite(userSuite);
	const { beforeAll, afterAll, paramNames: paramDef } = suite;

	const baseline = convertBaseline(suite);
	const profilers = resolveProfilers(suite);

	const context = new ProfilingContext(suite, profilers, options);
	await beforeAll?.();
	await context.run().finally(afterAll);

	const { scenes, notes, meta } = context;
	return { notes, meta, baseline, paramDef, scenes } as RunSuiteResult;
}
