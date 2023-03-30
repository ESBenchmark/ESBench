import { noop } from "@kaciras/utilities/browser";

export type BenchmarkFn = () => any;

export interface SuiteOptions {
	params?: ParamsConfig;
	time?: number;
	iterations?: number | string;
}

export type MainFn = (suite: BenchmarkContext, params: ConfigData) => void;

export type ConfigData = Record<string, any>;

export interface BenchmarkCase {
	name: string;
	async: boolean;
	fn: BenchmarkFn;
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

	add(name: string, fn: BenchmarkFn) {
		this.benchmarks.push({ name, fn, async: false });
	}

	addAsync(name: string, fn: BenchmarkFn) {
		this.benchmarks.push({ name, fn, async: true });
	}
}

export type ParamsConfig = Record<string, any[]>;

export function defineBenchmark(options: SuiteOptions, mainFn: MainFn) {
	return { options, mainFn };
}
