import { noop } from "@kaciras/utilities/browser";

export type AsyncWorkload = () => Promise<unknown>;

export type SyncWorkload = () => unknown;

export type Workload = AsyncWorkload | SyncWorkload;

export interface SuiteOptions {
	params?: ParamsConfig;
	time?: number;
	iterations?: number | string;
}

export interface BenchmarkCase {
	name: string;
	async: boolean;
	workload: Workload;
}

export class BenchmarkContext {

	readonly benchmarks: BenchmarkCase[] = [];

	setupHook: () => any = noop;
	teardownHook: () => any = noop;

	beforeEach(fn: () => any) {
		this.setupHook = fn;
	}

	afterEach(fn: () => any) {
		this.teardownHook = fn;
	}

	add(name: string, fn: SyncWorkload) {
		this.benchmarks.push({ name, workload: fn, async: false });
	}

	addAsync(name: string, fn: AsyncWorkload) {
		this.benchmarks.push({ name, workload: fn, async: true });
	}
}

export type ParamsConfig = Record<string, any[]>;

export type MainFn = (suite: BenchmarkContext, params: ConfigData) => void;

export type ConfigData = Record<string, any>;

export function defineBenchmark(options: SuiteOptions, mainFn: MainFn) {
	return { options, mainFn };
}
