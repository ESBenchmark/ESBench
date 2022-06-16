import { NOOP } from "./utils.js";
import { ConfigData } from "./core.js";

export type BenchmarkFn = () => any;

interface BenchmarkCase {
	name: string;
	async: boolean;
	fn: BenchmarkFn;
}

export class BenchmarkContext {

	readonly benchmarks: BenchmarkCase[] = [];

	setupHook: () => any = NOOP;
	teardownHook: () => any = NOOP;

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

export interface SuiteOptions {
	params?: ParamsConfig;
	time?: number;
	iterations?: number | string;
}

type MainFn = (suite: BenchmarkContext, params: ConfigData) => void;

export function defineBenchmark(options: SuiteOptions, build: MainFn) {
	return { options, build };
}
