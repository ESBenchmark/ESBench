import { Awaitable, CPCellObject, CPSrcObject } from "@kaciras/utilities/browser";
import { runHooks } from "./utils.js";
import { ValidateOptions } from "./validate.js";
import { TimingOptions } from "./time.js";

type AsyncWorkload = () => Promise<unknown>;

type SyncWorkload = () => unknown;

export type Workload = AsyncWorkload | SyncWorkload;

export class BenchCase {

	readonly setupHooks: HookFn[];
	readonly cleanHooks: HookFn[];

	readonly name: string;
	readonly fn: Workload;
	readonly isAsync: boolean;

	constructor(scene: Scene, name: string, fn: Workload) {
		this.name = name;
		this.fn = fn;
		this.setupHooks = scene.setupIteration;
		this.cleanHooks = scene.cleanIteration;
		this.isAsync = fn.constructor !== Function;
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
		if (/^\s*$/.test(name)) {
			throw new Error("Workload name cannot be a blank string.");
		}
		if (this.cases.some(c => c.name === name)) {
			throw new Error(`Workload "${name}" already exists.`);
		}
		if (!this.include.test(name)) {
			return;
		}
		this.cases.push(new BenchCase(this, name, fn));
	}
}

export type SetupScene<T extends CPSrcObject> = (scene: Scene<CPCellObject<T>>) => Awaitable<void>;

export interface BenchmarkSuite<T extends CPSrcObject> {
	name: string;
	setup: SetupScene<T>;

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

	params?: T;
	afterAll?: HookFn;
}

type Empty = Record<string, never>;

export function defineSuite<const T extends CPSrcObject = Empty>(suite: BenchmarkSuite<T>) {
	return suite;
}
