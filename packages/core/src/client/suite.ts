import { Awaitable, CPRowObject, CPSrcObject } from "@kaciras/utilities/browser";

export type AsyncWorkload = () => Promise<unknown>;

export type SyncWorkload = () => unknown;

export type Workload = AsyncWorkload | SyncWorkload;

type HookFn = () => Awaitable<unknown>;

export interface SuiteOptions {
	turns?: number;
	iterations?: number | string;
}

export interface BenchmarkCase {
	name: string;
	async: boolean;
	workload: Workload;
}

export class BenchmarkContext {

	readonly benchmarks: BenchmarkCase[] = [];

	// readonly cleanAll: HookFn[] = [];
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

	// afterAll(fn: HookFn) {
	// 	this.cleanAll.push(fn);
	// }

	add(name: string, workload: SyncWorkload) {
		this.benchmarks.push({ name, workload, async: false });
	}

	addAsync(name: string, workload: AsyncWorkload) {
		this.benchmarks.push({ name, workload, async: true });
	}
}

export type MainFn<T extends CPSrcObject> = (suite: BenchmarkContext, params: CPRowObject<T>) => void;

export type ConfigData = Record<string, any>;

export interface BenchmarkModule<T extends CPSrcObject> {
	mainFn: MainFn<T>;
	options: SuiteOptions;
	params?: T;
	afterAll?: HookFn;
}

type Empty = Record<string, never>;

export function defineBenchmark<T extends CPSrcObject = Empty>(options: SuiteOptions<T>, mainFn: MainFn<T>) {
	return { options, mainFn } as BenchmarkModule<T>;
}
