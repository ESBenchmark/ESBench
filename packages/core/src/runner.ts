import { Awaitable, noop } from "@kaciras/utilities/browser";
import { ErrorObject, serializeError } from "serialize-error";
import { BaselineOptions, BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ExecutionValidator } from "./validate.js";
import { TimeProfiler } from "./time.js";
import { BUILTIN_VARS, checkParams, toDisplayName } from "./utils.js";
import { CaseResult, LogHandler, LogLevel, MetricMeta, Note, Profiler, ProfilingContext } from "./context.js";

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

export class RunSuiteError extends Error {

	/**
	 * The params property of the scene that threw the error,
	 * or undefined if the error did not occur in a scene.
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
}

RunSuiteError.prototype.name = "RunSuiteError";

export interface RunSuiteResult {
	name: string;
	paramDef: Array<[string, string[]]>;
	meta: Record<string, MetricMeta>;
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
	const {
		name, beforeAll = noop, afterAll = noop,
		timing, validate, params = {}, baseline,
	} = suite;

	if (baseline) {
		if (!BUILTIN_VARS.includes(baseline.type)) {
			baseline.value = toDisplayName(baseline.value);
		}
	}

	let context: ProfilingContext | undefined = undefined;
	try {
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
		context = new ProfilingContext(suite, profilers, options);

		await beforeAll();
		await context.run().finally(afterAll);

		const { scenes, notes, meta } = context;
		return { name, notes, meta, baseline, paramDef, scenes } as RunSuiteResult;
	} catch (e) {
		const wp = (context as any)?.workingParams;
		if (wp) {
			const p: Record<string, string> = {};
			for (const [k, v] of Object.entries(wp)) {
				p[k] = toDisplayName(v);
			}
			const s = JSON.stringify(p);
			const message = "Error occurred in scene " + s;
			throw new RunSuiteError(message, e, wp, s);
		}
		throw new RunSuiteError("Error occurred when running suite.", e);
	}
}

type ErrorMessage = { e: ErrorObject; params?: string };

type LogMessage = { log?: string; level: LogLevel };

/**
 * Some types of objects that need to be sent to the host.
 *
 * How to detect the type:
 * - "level" in message: it's a LogMessage.
 * - "e" in message: it's an ErrorMessage.
 * - otherwise it is a RunSuiteResult object.
 */
export type ClientMessage = RunSuiteResult | ErrorMessage | LogMessage;

/**
 * A function that load benchmark suites. Provided by builders.
 */
export type Importer = (path: string) => Awaitable<{ default: BenchmarkSuite }>;

/**
 * A function that post messages to the host. Provided by executors.
 *
 * Log messages are sent multiple times, others are sent only once.
 *
 * If you implement an executor that does not support continuous transmission
 * of messages, you can ignore logs.
 */
export type Channel = (message: ClientMessage) => Awaitable<void>;

export async function connect(
	postMessage: Channel,
	importer: Importer,
	files: string[],
	pattern?: string,
) {
	const option: RunSuiteOption = {
		log: (level, log) => postMessage({ level, log }),
		pattern: pattern ? new RegExp(pattern) : undefined,
	};

	try {
		for (const file of files) {
			const suite = await importer(file);
			postMessage(await runSuite(suite.default, option));
		}
	} catch (e) {
		let params: string | undefined;
		if (e.name === "RunSuiteError") {
			params = e.paramStr;
			e = e.cause;
		}
		postMessage({ e: serializeError(e), params });
	}
}
