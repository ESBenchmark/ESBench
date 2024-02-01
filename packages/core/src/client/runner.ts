import { Awaitable, cartesianObject, noop } from "@kaciras/utilities/browser";
import { BaselineOptions, BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { ExecutionValidator } from "./validate.js";
import { TimeProfiler } from "./time.js";
import { BUILTIN_FIELDS, checkParams, consoleLogHandler, DefaultEventLogger, runFns, toDisplayName } from "./utils.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type LogHandler = (level: LogLevel, message?: string) => Awaitable<any>;

const MATCH_ANY = new RegExp("");

export class ProfilingContext {

	/**
	 * Result for each case in each scene.
	 */
	readonly scenes: CaseResult[][] = [];

	/**
	 * Notes collected from the profiling.
	 */
	readonly notes: Note[] = [];

	readonly meta: Record<string, MetricMeta> = {};

	readonly suite: BenchmarkSuite;
	readonly profilers: Profiler[];
	readonly pattern: RegExp;
	readonly logHandler: LogHandler;

	private hasRun = false;
	private caseIndex = 0;

	constructor(suite: BenchmarkSuite, profilers: Profiler[], options: RunSuiteOption) {
		this.suite = suite;
		this.profilers = profilers;
		this.pattern = options.pattern ?? MATCH_ANY;
		this.logHandler = options.log ?? consoleLogHandler;
	}

	get sceneCount() {
		const lists: unknown[][] = Object.values(this.suite.params ?? {});
		return lists.length === 0 ? 1 : lists.reduce((s, v) => s + v.length, 0);
	}

	/**
	 * Using this method will generate warnings, which are logs with log level "warn".
	 */
	warn(message?: string) {
		return this.logHandler("warn", message);
	}

	/**
	 * Generate an "info" log. As these logs are displayed by default, use them for information
	 * that is not a warning but makes sense to display to all users on every build.
	 */
	info(message?: string) {
		return this.logHandler("info", message);
	}

	/**
	 * Add a note to result, it will print a log and displayed in the report.
	 *
	 * The different between notes and logs is note is that
	 * notes are only relevant to the result, while logs can record anything.
	 *
	 * @param type Type of the note, "info" or "warn".
	 * @param text The message of this note.
	 * @param case_ The case associated with this note.
	 */
	note(type: "info" | "warn", text: string, case_?: BenchCase) {
		this.notes.push({ type, text, caseId: case_?.id });
		return this.logHandler(type, text);
	}

	newWorkflow(profilers: Profiler[], options: RunSuiteOption = {}) {
		return new ProfilingContext(this.suite, profilers, options);
	}

	/**
	 * Run the profiling, the result is saved at `scenes` & `notes` properties.
	 */
	async run() {
		const { hasRun, pattern, suite } = this;
		if (hasRun) {
			throw new Error("A context can only be run once.");
		}
		this.hasRun = true;

		const { params = {}, setup } = suite;
		await this.runHooks("onSuite");

		for (const comb of cartesianObject(params)) {
			const scene = new Scene(comb, pattern);
			await setup(scene);
			try {
				await this.runScene(scene);
			} finally {
				await runFns(scene.cleanEach);
			}
		}
		return this.runHooks("onFinish");
	}

	private async runScene(scene: Scene) {
		await this.runHooks("onScene", scene);

		const workloads: CaseResult[] = [];
		this.scenes.push(workloads);

		for (const case_ of scene.cases) {
			case_.id = this.caseIndex++;
			const metrics = {};
			await this.runHooks("onCase", case_, metrics);
			workloads.push({ name: case_.name, metrics });
		}
	}

	private async runHooks<K extends keyof Profiler>(name: K, ...args: any[]) {
		for (const profiler of this.profilers) {
			// @ts-expect-error Is it a TypeScript bug?
			await profiler[name]?.(this, ...args);
		}
	}
}

export interface Profiler {

	onSuite?: (ctx: ProfilingContext) => Awaitable<void>;

	onScene?: (ctx: ProfilingContext, scene: Scene) => Awaitable<void>;

	onCase?: (ctx: ProfilingContext, case_: BenchCase, metrics: Metrics) => Awaitable<void>;

	onFinish?: (ctx: ProfilingContext) => Awaitable<void>;
}

export interface CaseResult {
	name: string;
	metrics: Metrics;
}

export type Metrics = Record<string, number | number[] | string>;

export enum MetricAnalyzing {
	/**
	 * There is no analyze performed to the metric. This is the default value.
	 */
	None,

	/**
	 * Reporters should show diff with another result if present for the metric.
	 * The metric value must be a number.
	 */
	Compare,

	/**
	 * Reporters should display statistical indicators (stdDev, percentiles...) for the metric.
	 * The metric value must be an array of number with at least 1 element.
	 */
	Statistics,
}

export interface MetricMeta {
	format?: string;
	analyze?: MetricAnalyzing;
	lowerBetter?: boolean;
}

export interface Note {
	type: "info" | "warn";
	text: string;
	caseId?: number;
}

export interface RunSuiteResult {
	name: string;
	paramDef: Record<string, string[]>;
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

export async function runSuite(suite: BenchmarkSuite, options: RunSuiteOption) {
	const { name, afterAll = noop, timing = {}, validate, params = {}, baseline } = suite;

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
		channel({ log: `Suite execution failed: ${e.message}`, level: "error" });
	}
}
