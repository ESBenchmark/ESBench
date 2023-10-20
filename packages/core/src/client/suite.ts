import { Awaitable, CPRowObject, CPSrcObject } from "@kaciras/utilities/browser";

export type AsyncWorkload = () => Promise<unknown>;

export type SyncWorkload = () => unknown;

export type Workload = AsyncWorkload | SyncWorkload;

export interface SuiteOptions {
	samples?: number;
	iterations?: number | string;
}

export interface BenchmarkCase {
	name: string;
	isAsync: boolean;
	workload: Workload;
}

export type HookFn = () => Awaitable<unknown>;

export class Scene {

	readonly benchmarks: BenchmarkCase[] = [];

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
		this.benchmarks.push({ name, workload, isAsync: false });
	}

	addAsync(name: string, workload: AsyncWorkload) {
		this.benchmarks.push({ name, workload, isAsync: true });
	}
}

export type CreateScene<T extends CPSrcObject> = (scene: Scene, params: CPRowObject<T>) => Awaitable<void>;

export interface BenchmarkModule<T extends CPSrcObject> {
	main: CreateScene<T>;
	params?: T;
	afterAll?: HookFn;
	options?: SuiteOptions;
}

type Empty = Record<string, never>;

export function defineSuite<const T extends CPSrcObject = Empty>(suite: BenchmarkModule<T>) {
	return suite;
}
