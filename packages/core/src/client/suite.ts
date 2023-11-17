import { Awaitable, CPRowObject, CPSrcObject } from "@kaciras/utilities/browser";
import { runHooks } from "./utils.js";
import { ValidateOptions } from "./validate.js";

type AsyncWorkload = () => Promise<unknown>;

type SyncWorkload = () => unknown;

export type Workload = AsyncWorkload | SyncWorkload;

export class BenchCase {

	readonly setupHooks: HookFn[];
	readonly cleanHooks: HookFn[];

	readonly name: string;
	readonly fn: Workload;
	readonly isAsync: boolean;

	constructor(scene: Scene, name: string, fn: Workload, isAsync: boolean) {
		this.name = name;
		this.fn = fn;
		this.isAsync = isAsync;
		this.setupHooks = scene.setupIteration;
		this.cleanHooks = scene.cleanIteration;
	}

	async invoke() {
		await runHooks(this.setupHooks);
		try {
			return this.fn();
		} finally {
			await runHooks(this.cleanHooks);
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

	beforeIteration(fn: HookFn) {
		this.setupIteration.push(fn);
	}

	afterIteration(fn: HookFn) {
		this.cleanIteration.push(fn);
	}

	afterEach(fn: HookFn) {
		this.cleanEach.push(fn);
	}

	bench(name: string, fn: SyncWorkload) {
		this.add(name, fn, false);
	}

	benchAsync(name: string, fn: AsyncWorkload) {
		this.add(name, fn, true);
	}

	private add(name: string, fn: Workload, isAsync: boolean) {
		if (/^\s*$/.test(name)) {
			throw new Error("Workload name cannot be a blank string.");
		}
		if (this.cases.some(c => c.name === name)) {
			throw new Error(`Workload "${name}" already exists.`);
		}
		if (!this.include.test(name)) {
			return;
		}
		this.cases.push(new BenchCase(this, name, fn, isAsync));
	}
}

export interface SuiteConfig {

	/**
	 * How many target iterations should be performed.
	 *
	 * @default 10
	 */
	samples?: number;

	/**
	 * How many warmup iterations should be performed.
	 * The value can be 0, which disables warmup.
	 *
	 * @default 5
	 */
	warmup?: number;

	/**
	 * how many times the benchmark method will be invoked per one iteration of a generated loop.
	 *
	 * @default 16
	 */
	unrollFactor?: number;

	/**
	 * Invocation count or time in a single iteration.
	 *
	 * If the value is a number it used as invocation count, must be a multiple of unrollFactor.
	 *
	 * It is a duration string, it used by Pilot stage to estimate the number of invocations per iteration.
	 *
	 * @default "1s"
	 */
	iterations?: number | string;

	/**
	 * Checks if it is possible to run your benchmarks.
	 * If set, all scenes and their benchmarks will be run once to ensure no exceptions.
	 *
	 * Additional checks can be configured in the options.
	 */
	validate?: ValidateOptions;
}

export type SetupScene<T extends CPSrcObject> = (scene: Scene<CPRowObject<T>>) => Awaitable<void>;

export interface BenchmarkSuite<T extends CPSrcObject> {
	name: string;
	setup: SetupScene<T>;
	params?: T;
	afterAll?: HookFn;
	config?: SuiteConfig;
}

type Empty = Record<string, never>;

export function defineSuite<const T extends CPSrcObject = Empty>(suite: BenchmarkSuite<T>) {
	return suite;
}
