import { NOOP } from "./utils.js";

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


export function defineBenchmark(options: SuiteOptions, build: MainFn) {
	return { options, build };
}
