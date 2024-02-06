import { Awaitable, cartesianObject } from "@kaciras/utilities/browser";
import { RunSuiteOption } from "./runner.js";
import { BenchCase, BenchmarkSuite, Scene } from "./suite.js";
import { consoleLogHandler, RE_ANY, runFns } from "./utils.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Calling this function always requires `await` in order to send the message as soon as possible.
 */
export type LogHandler = (level: LogLevel, message?: string) => Awaitable<any>;

export interface CaseResult {
	name: string;
	metrics: Metrics;
}

export type Metrics = Record<string, number | number[] | string | undefined>;

export enum MetricsAnalysis {
	/**
	 * There is no analyze performed to the metrics. This is the default value.
	 */
	None,

	/**
	 * Reporters should show diff with another result if present for the metrics.
	 * The metrics value must be a number.
	 */
	Compare,

	/**
	 * Reporters should display statistical indicators (stdDev, percentiles...) for the metrics.
	 * The metrics value must be an array of number with at least 1 element.
	 */
	Statistics,
}

export interface MetricsMeta {
	format?: string;
	analyze?: MetricsAnalysis;
	lowerBetter?: boolean;
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

	readonly meta: Record<string, MetricsMeta> = {};

	readonly suite: BenchmarkSuite;
	readonly profilers: Profiler[];
	readonly pattern: RegExp;
	readonly logHandler: LogHandler;

	private hasRun = false;
	private caseIndex = 0;

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
		await this.runHooks("onStart");

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
