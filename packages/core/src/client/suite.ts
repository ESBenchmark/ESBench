import { Awaitable, CPCellObject, CPSrcObject, uniqueId } from "@kaciras/utilities/browser";
import { runFns } from "./utils.js";
import { ValidateOptions } from "./validate.js";
import { TimingOptions } from "./time.js";

type AsyncWorkload = () => Promise<unknown>;

type SyncWorkload = () => unknown;

export type Workload = AsyncWorkload | SyncWorkload;

export class BenchCase {

	readonly setupHooks: HookFn[];
	readonly cleanHooks: HookFn[];

	/**
	 * A unique number within a suite execution.
	 */
	readonly id = uniqueId();

	readonly name: string;
	readonly fn: Workload;
	readonly isAsync: boolean;

	constructor(scene: Scene, name: string, fn: Workload, isAsync: boolean) {
		this.name = name;
		this.fn = fn;
		this.setupHooks = scene.setupIteration;
		this.cleanHooks = scene.cleanIteration;
		this.isAsync = isAsync;
	}

	async invoke() {
		await runFns(this.setupHooks);
		try {
			return this.fn();
		} finally {
			await runFns(this.cleanHooks);
		}
	}
}

export type HookFn = () => Awaitable<unknown>;

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
	 */
	afterEach(fn: HookFn) {
		this.cleanEach.push(fn);
	}

	bench(name: string, fn: SyncWorkload) {
		this.add(name, fn, false);
	}

	benchAsync(name: string, fn: SyncWorkload) {
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
	private add(name: string, fn: SyncWorkload, isAsync: boolean) {
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

export type SetupScene<T extends CPSrcObject> = (scene: Scene<CPCellObject<T>>) => Awaitable<void>;

export type BaselineOptions = {
	/**
	 * Type of the baseline variable, can be one of:
	 * - "Name", "Builder", "Executor"
	 * - Any key of the suite's `param` option.
	 */
	type: string;

	/**
	 * Case with variable value equals to this is the baseline.
	 */
	value: any;
}

export interface BenchmarkSuite<T extends CPSrcObject = any> {
	name: string;
	setup: SetupScene<T>;

	afterAll?: HookFn;

	/**
	 * Measure the running time of the benchmark function.
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
	validate?: ValidateOptions;

	/**
	 * you can specify set of values.
	 * As a result, you will get results for each combination of params values.
	 */
	params?: T;

	/**
	 * In order to scale your results, you can mark a variable as a baseline.
	 */
	baseline?: BaselineOptions;
}

type Empty = Record<string, never>;

export function defineSuite<const T extends CPSrcObject = Empty>(suite: BenchmarkSuite<T>) {
	return suite;
}
