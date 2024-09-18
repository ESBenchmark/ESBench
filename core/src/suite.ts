import { Awaitable, ItemOfIterable } from "@kaciras/utilities/browser";
import { Profiler } from "./profiling.js";
import { TimeProfilerOptions } from "./time.js";
import { ValidateOptions } from "./validate.js";
import { ComplexityOptions } from "./complexity.js";
import { BUILTIN_VARS, RE_ANY, runFns, toDisplayName } from "./utils.js";

export type HookFn = () => Awaitable<unknown>;

type Workload = () => Awaitable<unknown>;

export class BenchCase {

	readonly name: string;

	/**
	 * The workload function, should be called with iteration hooks.
	 *
	 * Always treat the iteration hooks and `fn` as a whole,
	 * calling `fn` separately will result in undefined behavior.
	 *
	 * @see BenchCase.invoke
	 */
	readonly fn: Workload;

	readonly beforeHooks: HookFn[];
	readonly afterHooks: HookFn[];

	/**
	 * true if the case defined by `benchAsync`, false for `bench`.
	 */
	readonly isAsync: boolean;

	/**
	 * A unique number within a suite execution.
	 * It is used to associate some objects with this case.
	 */
	id?: number;

	constructor(scene: Scene, name: string, fn: Workload, isAsync: boolean) {
		this.name = name;
		this.fn = fn;
		this.isAsync = isAsync;
		this.beforeHooks = scene.beforeIterHooks;
		this.afterHooks = scene.afterIterHooks;
	}

	/**
	 * Call the workload and each iteration hook once.
	 *
	 * The returned value is always awaited even if `isAsync` is false.
	 */
	async invoke(): Promise<any> {
		await runFns(this.beforeHooks);
		try {
			return await this.fn();
		} finally {
			await runFns(this.afterHooks);
		}
	}

	/**
	 * Create an new benchmark case for the workload function,
	 * and it has the same name & id with the original.
	 *
	 * `beforeHooks` and `afterHooks` can be added later.
	 *
	 * @param isAsync Indicates whether ESBench need to `await` for
	 *                the return value of `fn` while measuring.
	 * @param fn the new workload function.
	 */
	derive(isAsync: boolean, fn: Workload) {
		const instance: any = Object.create(BenchCase.prototype);
		instance.name = this.name;
		instance.fn = fn;
		instance.isAsync = isAsync;
		instance.beforeHooks = [];
		instance.afterHooks = [];
		instance.id = this.id;
		return instance as BenchCase;
	}
}

export class Scene<P = any> {

	readonly teardownHooks: HookFn[] = [];
	readonly beforeIterHooks: HookFn[] = [];
	readonly afterIterHooks: HookFn[] = [];
	readonly cases: BenchCase[] = [];

	readonly params: P;

	private readonly include: RegExp;

	constructor(params: P, include = RE_ANY) {
		this.params = params;
		this.include = include;
	}

	/**
	 * Register a callback to be called exactly once before each benchmark invocation.
	 * It's not recommended to use this in microbenchmarks because it can spoil the results.
	 */
	beforeIteration(fn: HookFn) {
		this.beforeIterHooks.push(fn);
	}

	/**
	 * Register a callback to be called exactly once after each invocation.
	 * It's not recommended to use this in microbenchmarks because it can spoil the results.
	 */
	afterIteration(fn: HookFn) {
		this.afterIterHooks.push(fn);
	}

	/**
	 * Teardown function to run after all case in the scene are executed.
	 */
	teardown(fn: HookFn) {
		this.teardownHooks.push(fn);
	}

	/**
	 * Add a benchmark case to the scene, and consider an execution complete when `fn` returns.
	 *
	 * For asynchronous function, you may need to use `benchAsync` instead.
	 *
	 * @param name Name of the case
	 * @param fn The workload function
	 */
	bench(name: string, fn: Workload) {
		this.add(name, fn, false);
	}

	/**
	 * Add a benchmark case to the scene. If `fn` returns a Promise, it will be awaited.
	 *
	 * For synchronized function `bench` should be used to avoid the overhead of `await`.
	 *
	 * @param name Name of the case
	 * @param fn The workload function
	 */
	benchAsync(name: string, fn: Workload) {
		this.add(name, fn, true);
	}

	/*
	 * Don't use `isAsync = fn.constructor !== Function` because the fn can be
	 * non-async and return a Promise.
	 *
	 * For example:
	 * scene.bench("name", () => asyncFn(args));
	 *
	 * It can be fixed by adding `await` to the function, but it impacts performance.
	 * Related benchmark: example/es/async-return-promise.js
	 */
	private add(name: string, fn: Workload, isAsync: boolean) {
		const { length } = name.trim();
		if (length === 0) {
			throw new Error("Case name cannot be blank.");
		}
		if (length !== name.length) {
			throw new Error("Case name cannot have leading or trailing spaces.");
		}
		if (this.cases.some(c => c.name === name)) {
			throw new Error(`Case "${name}" already exists.`);
		}
		if (this.include.test(name)) {
			this.cases.push(new BenchCase(this, name, fn, isAsync));
		}
	}
}

export interface BaselineOptions {
	/**
	 * Type of the baseline variable, can be one of:
	 * - "Name", "Builder", "Executor"
	 * - Any key of suite's `params` object.
	 */
	type: string;

	/**
	 * Case with variable value equals to this is the baseline.
	 */
	value: unknown;
}

export type ParamsDef = Record<string, Iterable<unknown> | Record<string, unknown>>;

type SceneParams<T extends ParamsDef> = {
	-readonly [K in Exclude<keyof T, symbol>]: T[K] extends Iterable<unknown>
		? ItemOfIterable<T[K]> : T[K][keyof T[K]]
};

export type ParamsAny = Record<string, any[] | Record<string, any>>;

type Empty = Record<string, undefined[] | Record<string, undefined>>;

export interface BenchmarkSuite<T extends ParamsDef = ParamsAny> {
	/**
	 * Setup each scene, add your benchmark cases.
	 */
	setup: (scene: Scene<SceneParams<T>>) => Awaitable<void>;

	/**
	 * Runs a function before running the suite.
	 */
	beforeAll?: HookFn;

	/**
	 * Runs a function after the suite has finished running.
	 */
	afterAll?: HookFn;

	/**
	 * Add more profilers for the suite, falsy values are ignored.
	 *
	 * @see https://esbench.vercel.app/api/profiler
	 */
	profilers?: Array<Profiler | false | undefined>;

	/**
	 * Measure the running time of the benchmark function.
	 * true is equivalent to not specifying the option and will always choose the default value.
	 *
	 * @default true
	 * @see https://esbench.vercel.app/guide/time-profiler
	 */
	timing?: boolean | TimeProfilerOptions;

	/**
	 * Checks if it is possible to run your benchmarks.
	 * If set, all scenes and their cases will be run once to ensure no exceptions.
	 *
	 * Additional checks can be configured in the options.
	 *
	 * @see https://esbench.vercel.app/guide/validation
	 */
	validate?: ValidateOptions<SceneParams<T>>;

	/**
	 * Calculate asymptotic complexity of benchmark cases.
	 *
	 * @see https://esbench.vercel.app/guide/complexity
	 */
	complexity?: ComplexityOptions<T>;

	/**
	 * you can specify set of values. As a result, you will get results
	 * for each combination of params values.
	 *
	 * If not specified, or it is an empty object, the suite will have one scene with empty params.
	 *
	 * The keys for the suite parameters must be the same under all toolchains.
	 *
	 * @see https://esbench.vercel.app/guide/parameterization
	 */
	params?: T;

	/**
	 * Mark a variable as a baseline to scale your results.
	 *
	 * @example
	 * // The result with baseline: { type: "Name", value: "For-index" }
	 * | No. |         Name |      time | time.ratio |
	 * | --: | -----------: | --------: | ---------: |
	 * |   0 |    For-index |  11.39 us |   baseline |
	 * |   1 |       For-of |  27.36 us |      2.40x |
	 * |   2 | Array.reduce |   1.99 us |      0.17x |
	 *
	 * @see https://esbench.vercel.app/guide/comparison#baseline
	 */
	baseline?: BaselineOptions;
}

export type UserSuite<T extends ParamsDef = ParamsAny> = BenchmarkSuite<T> | BenchmarkSuite<Empty>["setup"];

/**
 * Type helper to mark the object as an ESBench suite.
 * IDE plugins also require it to find benchmark cases.
 */
export const defineSuite = <const T extends ParamsDef = Empty>(suite: UserSuite<T>) => suite;

export type Entries<T = unknown> = Array<[string, T[]]>;

export type NormalizedSuite = Omit<BenchmarkSuite, "timing" | "params"> & {
	/**
	 * Entries of params, for generating Cartesian product to create scenes.
	 *
	 * @example
	 * // The params of user suite:
	 * const symbol = Symbol("desc");
	 * const input = {
	 *     foo: { bool: true, text: "baz" },
	 *     bar: [11, null, symbol],
	 * }
	 * // The params of NormalizedSuite:
	 * const params = [
	 *     ["foo", [true, "baz"]],
	 *     ["bar", [11, null, symbol]],
	 * ]
	 */
	params: Entries;

	/**
	 * Parallel array of `params`, with each value replaced by its display name.
	 *
	 * @example
	 * // The params of user suite:
	 * const symbol = Symbol("desc");
	 * const input = {
	 *     foo: { bool: true, text: "baz" },
	 *     bar: [11, null, symbol],
	 * }
	 * // The paramNames:
	 * const params = [
	 *     ["foo", ["bool", "text"]],
	 *     ["bar", ["11", "null", "Symbol(desc)"]],
	 * ]
	 */
	paramNames: Entries<string>;

	/**
	 * Unlike `BenchmarkSuite`, the undefined means TimeProfiler disabled.
	 */
	timing?: TimeProfilerOptions;
}

function* getFromIter(values: Iterable<unknown>) {
	for (const value of values) yield [value, value];
}

function getFromObject(values: Record<string, unknown>) {
	return Object.entries(values);
}

export function resolveParams(params: ParamsDef) {
	const nameEntries = Object.entries(params);
	const valueEntries: Entries = new Array(nameEntries.length);

	if (Object.getOwnPropertySymbols(params).length) {
		throw new Error("Only string keys are allowed in param");
	}

	for (let i = 0; i < nameEntries.length; i++) {
		const [key, valueDefs] = nameEntries[i];

		if (BUILTIN_VARS.includes(key)) {
			throw new Error(`'${key}' is a builtin variable`);
		}
		const names = new Set<string>();
		const values: unknown[] = [];

		const iter = Symbol.iterator in valueDefs
			? getFromIter(valueDefs)
			: getFromObject(valueDefs);

		for (const [name, value] of iter) {
			const display = toDisplayName(name);
			if (names.has(display)) {
				throw new Error(`Parameter display name conflict (${key}: ${display})`);
			}
			names.add(display);
			values.push(value);
		}

		nameEntries[i][1] = [...names];
		valueEntries[i] = [key, values];

		if (names.size === 0) {
			throw new Error(`Suite parameter "${key}" must have a value`);
		}
	}

	return [valueEntries, nameEntries as Entries<string>] as const;
}

export function normalizeSuite(input: UserSuite): NormalizedSuite {
	if (typeof input === "function") {
		return { params: [], paramNames: [], timing: {}, setup: input };
	}
	const [params, paramNames] = resolveParams(input.params ?? {});

	let timing: TimeProfilerOptions | undefined;
	switch (input.timing) {
		case true:
		case undefined:
			timing = {};
			break;
		case false:
			timing = undefined;
			break;
		default:
			timing = input.timing;
	}

	return { ...input, params, paramNames, timing };
}
