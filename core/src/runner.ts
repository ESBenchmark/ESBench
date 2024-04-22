import { Awaitable, CPSrcObject } from "@kaciras/utilities/browser";
import { deserializeError, ErrorObject, serializeError } from "serialize-error";
import { BaselineOptions, BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ExecutionValidator } from "./validate.js";
import { TimeProfiler } from "./time.js";
import { BUILTIN_VARS, checkParams, toDisplayName } from "./utils.js";
import { LogHandler, LogLevel, MetricMeta, Note, Profiler, ProfilingContext, SceneResult } from "./profiling.js";
import { ToolchainResult } from "./summary.js";

class DefaultEventLogger implements Profiler {

	private sceneIndex = 0;
	private caseOfScene = 0;

	onStart(ctx: ProfilingContext) {
		return ctx.info(`\nSuite: ${ctx.suite.name}, ${ctx.sceneCount} scenes.`);
	}

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
		const { name, isAsync, setupHooks, cleanHooks } = case_;
		const hooks = setupHooks.length + cleanHooks.length > 0;
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

	toJSON() {
		const { name, stack, message, paramStr } = this;
		return {
			name, stack, message, paramStr,
			cause: serializeError(this.cause),
		};
	}
}

RunSuiteError.prototype.name = "RunSuiteError";

export interface RunSuiteResult {
	name: string;
	paramDef: Array<[string, string[]]>;
	meta: Record<string, MetricMeta>;
	notes: Note[];
	scenes: SceneResult[];
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
export async function runSuite(suite: BenchmarkSuite, options: RunSuiteOption = {}) {
	const { name, beforeAll, afterAll, timing, validate, params = {}, baseline } = suite;

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

		if (baseline) {
			checkBaseline(baseline, params);
		}

		const paramDef = checkParams(params);
		context = new ProfilingContext(suite, profilers, options);

		await beforeAll?.();
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
 * - Array.isArray(message): it is a RunSuiteResult array.
 * - "e" in message: it's an ErrorMessage.
 * - "level" in message: it's a LogMessage.
 */
export type ClientMessage = RunSuiteResult[] | ErrorMessage | LogMessage;

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

/**
 * Import and run suites, then send the results over the channel.
 *
 * @param postMessage Function used to transfer the results to the host.
 * @param importer Function to import a suite, normally provided by builder.
 * @param files Paths of suite files.
 * @param pattern A Regexp string for filter benchmark cases by name.
 */
export async function runAndSend(
	postMessage: Channel,
	importer: Importer,
	files: string[],
	pattern?: string,
) {
	const option: RunSuiteOption = {
		log: (log, level) => postMessage({ level, log }),
		pattern: pattern ? new RegExp(pattern) : undefined,
	};

	const results: RunSuiteResult[] = [];
	try {
		for (const file of files) {
			const suite = await importer(file);
			results.push(await runSuite(suite.default, option));
		}
		return postMessage(results);
	} catch (e) {
		return postMessage({ e: serializeError(e) });
	}
}

/**
 * A helper to deal with runner messages, forward messages to `dispatch`
 * and then you can wait for the promise to finish runs.
 *
 * @param onLog function to handle log messages.
 */
export function messageResolver(onLog: LogHandler) {
	let resolve!: (value: ToolchainResult[]) => void;
	let reject!: (reason?: Error) => void;

	const promise = new Promise<ToolchainResult[]>((s, j) => {
		resolve = s;
		reject = j;
	});

	function dispatch(message: ClientMessage) {
		if (Array.isArray(message)) {
			resolve(message);
		} else if ("e" in message) {
			reject(deserializeError(message.e));
		} else {
			onLog(message.log, message.level);
		}
	}

	return { promise, resolve, reject, dispatch };
}
