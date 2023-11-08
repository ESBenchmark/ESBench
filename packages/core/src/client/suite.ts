import { Awaitable, CPRowObject, CPSrcObject } from "@kaciras/utilities/browser";

type AsyncWorkload = () => Promise<unknown>;

type SyncWorkload = () => unknown;

type Workload = AsyncWorkload | SyncWorkload;

export interface BenchmarkCase {
	name: string;
	isAsync: boolean;
	workload: Workload;
}

export type HookFn = () => Awaitable<unknown>;

export class Scene {

	readonly cases: BenchmarkCase[] = [];

	readonly cleanEach: HookFn[] = [];
	readonly setupIteration: HookFn[] = [];
	readonly cleanIteration: HookFn[] = [];

	beforeIteration(fn: HookFn) {
		this.setupIteration.push(fn);
	}

	afterIteration(fn: HookFn) {
		this.cleanIteration.push(fn);
	}

	afterEach(fn: HookFn) {
		this.cleanEach.push(fn);
	}

	add(name: string, workload: SyncWorkload) {
		this.check(name);
		this.cases.push({ name, workload, isAsync: false });
	}

	addAsync(name: string, workload: AsyncWorkload) {
		this.check(name);
		this.cases.push({ name, workload, isAsync: true });
	}

	private check(name: string) {
		if (/^\s*$/.test(name)) {
			throw new Error("Workload name cannot be a blank string.");
		}
		if (this.cases.some(c => c.name === name)) {
			throw new Error(`Workload "${name}" already exists.`);
		}
	}
}

export type CreateScene<T extends CPSrcObject> = (scene: Scene, params: CPRowObject<T>) => Awaitable<void>;

export type EqualityFn = (a: any, b: any) => boolean;

export interface SuiteConfig {

	/**
	 * How many target iterations should be performed.
	 * @default 10
	 */
	samples?: number;

	/**
	 * How many warmup iterations should be performed.
	 * @default 5
	 */
	warmup?: number;

	/**
	 * Invocation count or time in a single iteration.
	 *
	 * If the value is a number it used as invocation count.
	 *
	 * It is a duration string, it used by Pilot stage to
	 * estimate the number of invocations per iteration.
	 *
	 * @default "1s"
	 */
	iterations?: number | string;

	/**
	 * Checks if it is possible to run your benchmarks by executing each of them once.
	 */
	validateExecution?: boolean;

	/**
	 * Checks if benchmarks return equal values.
	 */
	validateReturnValue?: boolean | EqualityFn;
}

export interface BenchmarkSuite<T extends CPSrcObject> {
	name: string;
	setup: CreateScene<T>;
	params?: T;
	afterAll?: HookFn;
	config?: SuiteConfig;
}

type Empty = Record<string, never>;

export function defineSuite<const T extends CPSrcObject = Empty>(suite: BenchmarkSuite<T>) {
	return suite;
}
