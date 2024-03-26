import { Awaitable, cartesianObject } from "@kaciras/utilities/browser";
import { RunSuiteOption } from "./runner.js";
import { BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { consoleLogHandler, RE_ANY, runFns } from "./utils.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type LogHandler = (message: string | undefined, level: LogLevel) => Awaitable<any>;

export interface CaseResult {
	name: string;
	metrics: Metrics;
}

export type Metrics = Record<string, number | number[] | string | undefined>;

export enum MetricAnalysis {
	/**
	 * There is no analyze performed to the metric. This is the default value.
	 */
	None,

	/**
	 * Reporters should show diff & ratio with another result if present for the metric.
	 * The metric value must be a number or an array of number with at least 1 element.
	 */
	Compare,

	/**
	 * Reporters should display statistical indicators (stdDev, percentiles...) for the metric.
	 * The metric value must be an array of number with at least 1 element.
	 *
	 * Setting this value will also apply MetricAnalysis.Compare
	 */
	Statistics,
}

export interface MetricMeta {
	/**
	 * Property name of the metric in case metrics.
	 */
	key: string;

	/**
	 * Specific the format when this metric displayed as text.
	 * This option is ignored if the value is a string.
	 *
	 * @example
	 * "{duration.ms}" // The metric is millisecond and should be formatted as duration.
	 * "{number} ops/s" // The value 2000 will be formatted to "2K ops/s".
	 */
	format?: string;

	/**
	 * Control which metrics can be derived from this.
	 *
	 * @default MetricAnalysis.None
	 */
	analysis?: MetricAnalysis;

	/**
	 * Does a smaller value of the metric mean better performance?
	 * This option must be set if `analysis` of the meta is not `None`.
	 */
	lowerIsBetter?: boolean;
}

export interface Note {
	type: "info" | "warn";
	text: string;
	caseId?: number;
}

export interface Profiler {

	onStart?: (ctx: ProfilingContext) => Awaitable<void>;

	onScene?: (ctx: ProfilingContext, scene: Scene) => Awaitable<void>;

	onCase?: (ctx: ProfilingContext, case_: BenchCase, metrics: Metrics) => Awaitable<void>;

	onFinish?: (ctx: ProfilingContext) => Awaitable<void>;
}

export class ProfilingContext {

	/**
	 * Result for each case in each scene.
	 */
	readonly scenes: CaseResult[][] = [];

	/**
	 * Notes collected from the profiling.
	 */
	readonly notes: Note[] = [];

	/**
	 * Descriptions of metrics. Profiler should add the metric descriptions they need to report on.
	 *
	 * Values in the case metric without corresponding description will not be shown in the report,
	 * but they will still be serialized.
	 */
	readonly meta: Record<string, MetricMeta> = {};

	readonly suite: BenchmarkSuite;
	readonly profilers: Profiler[];
	readonly pattern: RegExp;
	readonly logHandler: LogHandler;

	private hasRun = false;
	private caseIndex = 0;
	private workingParams: any;

	constructor(suite: BenchmarkSuite, profilers: Profiler[], options: RunSuiteOption) {
		this.suite = suite;
		this.profilers = profilers;
		this.pattern = options.pattern ?? RE_ANY;
		this.logHandler = options.log ?? consoleLogHandler;
	}

	get sceneCount() {
		const lists: unknown[][] = Object.values(this.suite.params ?? {});
		return lists.length === 0 ? 1 : lists.reduce((s, v) => s + v.length, 0);
	}

	defineMetric(description: MetricMeta) {
		this.meta[description.key] = description;
	}

	/**
	 * Using this method will generate warnings, which are logs with log level "warn".
	 */
	warn(message?: string) {
		return this.logHandler(message, "warn");
	}

	/**
	 * Generate an "info" log. As these logs are displayed by default, use them for information
	 * that is not a warning but makes sense to display to all users on every build.
	 */
	info(message?: string) {
		return this.logHandler(message, "info");
	}

	/**
	 * Add a note to result, it will print a log and displayed in the report.
	 *
	 * The different between notes and logs is that
	 * notes are only relevant to the result, while logs can record anything.
	 *
	 * @param type Type of the note, "info" or "warn".
	 * @param text The message of this note.
	 * @param case_ The case associated with this note.
	 */
	note(type: "info" | "warn", text: string, case_?: BenchCase) {
		this.notes.push({ type, text, caseId: case_?.id });
		return this.logHandler(text, type);
	}

	/**
	 * Create a new ProfilingContext for the same suite.
	 */
	newWorkflow(profilers: Profiler[], options: RunSuiteOption = {}) {
		return new ProfilingContext(this.suite, profilers, options);
	}

	/**
	 * Run the profiling, the result is saved at `scenes` & `notes` properties.
	 */
	async run() {
		const { hasRun, suite: { params = {} } } = this;
		if (hasRun) {
			throw new Error("A ProfilingContext can only be run once.");
		}
		this.hasRun = true;

		await this.runHooks("onStart");
		for (const comb of cartesianObject(params)) {
			this.workingParams = comb;
			await this.runScene(comb);
			this.workingParams = undefined;
		}
		return this.runHooks("onFinish");
	}

	private async runScene(params: any) {
		const scene = new Scene(params, this.pattern);
		await this.suite.setup(scene);
		try {
			await this.runHooks("onScene", scene);

			const workloads: CaseResult[] = [];
			this.scenes.push(workloads);

			for (const case_ of scene.cases) {
				case_.id = this.caseIndex++;
				const metrics = {};
				await this.runHooks("onCase", case_, metrics);
				workloads.push({ name: case_.name, metrics });
			}
		} finally {
			await runFns(scene.cleanEach);
		}
	}

	private async runHooks<K extends keyof Profiler>(name: K, ...args: any[]) {
		for (const profiler of this.profilers) {
			// @ts-expect-error Is it a TypeScript bug?
			await profiler[name]?.(this, ...args);
		}
	}
}
