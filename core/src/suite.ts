import { Awaitable, CartesianObjectCell, CPSrcObject } from "@kaciras/utilities/browser";
import { runFns } from "./utils.js";
import { Profiler } from "./context.js";
import { TimingOptions } from "./time.js";
import { ValidateOptions } from "./validate.js";

type Empty = Record<string, never>;

export type HookFn = () => Awaitable<unknown>;

export type Workload = () => unknown;

export class BenchCase {

	readonly setupHooks: HookFn[];
	readonly cleanHooks: HookFn[];

	readonly name: string;
	readonly fn: Workload;

	/**
	 * true if the case defined by `benchAsync`, false for `bench`.
	 */
	readonly isAsync: boolean;

	/**
	 * A unique number within a suite execution.
	 */
	id!: number;

	constructor(scene: Scene, name: string, fn: Workload, isAsync: boolean) {
		this.name = name;
		this.fn = fn;
		this.setupHooks = scene.setupIteration;
		this.cleanHooks = scene.cleanIteration;
		this.isAsync = isAsync;
	}

	/**
	 * Call the fn and each iteration hooks once.
	 */
	async invoke() {
		await runFns(this.setupHooks);
		try {
			return this.fn();
		} finally {
			await runFns(this.cleanHooks);
		}
	}
}

export class Scene<P = any> {

	readonly setupIteration: HookFn[] = [];
	readonly cleanIteration: HookFn[] = [];
	readonly cleanEach: HookFn[] = [];
	readonly cases: BenchCase[] = [];

	readonly params: P;

	private readonly include: RegExp;

	constructor(params: P, include = new RegExp("")) {
		this.params = params;
		this.include = include;
	}

	/**
	 * Register a callback to be called exactly once before each benchmark invocation.
	 * It's not recommended to use this in microbenchmarks because it can spoil the results.
	 */
	beforeIteration(fn: HookFn) {
		this.setupIteration.push(fn);
	}

	/**
	 * Register a callback to be called  exactly once after each invocation.
	 * It's not recommended to use this in microbenchmarks because it can spoil the results.
	 */
	afterIteration(fn: HookFn) {
		this.cleanIteration.push(fn);
	}

	/**
	 * Teardown function to run after all case in the scene are executed.
	 *
	 * There is no beforeEach(), just put the setup code to suite.setup().
	 */
	afterEach(fn: HookFn) {
		this.cleanEach.push(fn);
	}

	bench(name: string, fn: Workload) {
		this.add(name, fn, false);
	}

	benchAsync(name: string, fn: Workload) {
		this.add(name, fn, true);
	}

	/*
	 * Don't use `isAsync = fn.constructor === AsyncFunction` because the fn can be
	 * non-async and return a Promise.
	 *
	 * For example:
	 * scene.bench("name", () => asyncFn(args));
	 *
	 * You can fix this by adding `await` to the arrow function, but it impacts performance.
	 * Related benchmark: example/src/async-return-promise.js
	 */
	private add(name: string, fn: Workload, isAsync: boolean) {
		if (/^\s*$/.test(name)) {
			throw new Error("Case name cannot be blank.");
		}
		if (this.cases.some(c => c.name === name)) {
			throw new Error(`Case "${name}" already exists.`);
		}
		if (this.include.test(name)) {
			this.cases.push(new BenchCase(this, name, fn, isAsync));
		}
	}
}

export type BaselineOptions = {
	/**
	 * Type of the baseline variable, can be one of:
	 * - "Name", "Builder", "Executor"
	 * - Any key of suite's `params` object.
	 */
	type: string;

	/**
	 * Case with variable value equals to this is the baseline.
	 */
	value: any;
}

export interface BenchmarkSuite<T extends CPSrcObject = any> {
	name: string;
	setup: (scene: Scene<CartesianObjectCell<T>>) => Awaitable<void>;

	/**
	 * Runs a function before running the suite.
	 */
	beforeAll?: HookFn;

	/**
	 * Runs a function after the suite has finished running.
	 */
	afterAll?: HookFn;

	/**
	 * Add more profilers for the suite.
	 */
	profilers?: Profiler[];

	/**
	 * Measure the running time of the benchmark function.
	 * true is equivalent to not specifying the option and will always choose the default value.
	 *
	 * @default true
	 */
	timing?: boolean | TimingOptions;

	/**
	 * Checks if it is possible to run your benchmarks.
	 * If set, all scenes and their benchmarks will be run once to ensure no exceptions.
	 *
	 * Additional checks can be configured in the options.
	 */
	validate?: ValidateOptions<CartesianObjectCell<T>>;

	/**
	 * you can specify set of values. As a result, you will get results for each combination of params values.
	 *
	 * If not specified, or it is an empty object, the suite will have one scene with empty params.
	 */
	params?: T;

	/**
	 * In order to scale your results, you can mark a variable as a baseline.
	 *
	 * @example
	 * // The result with baseline: { type: "Name", value: "map" }
	 * | No. |         Name |      time | time.ratio |
	 * | --: | -----------: | --------: | ---------: |
	 * |   0 |    For-index |  11.39 us |      1.00x |
	 * |   1 |       For-of |  27.36 us |      2.40x |
	 * |   2 | Array.reduce |   1.99 us |      0.17x |
	 */
	baseline?: BaselineOptions;
}

/**
 * Type helper to mark the object as an ESBench suite. IDE plugins require it to find benchmark cases.
 */
export function defineSuite<const T extends CPSrcObject = Empty>(suite: BenchmarkSuite<T>) {
	return suite;
}
