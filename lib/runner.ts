import { performance } from "perf_hooks";

export const BeforeAll = Symbol();
export const BeforeEach = Symbol();
export const AfterAll = Symbol();
export const AfterEach = Symbol();

export type BenchmarkFn = () => any;

interface BenchmarkCase {
	name: string;
	fn: BenchmarkFn;
}

class BenchmarkSuite {

	readonly benchmarks: BenchmarkCase[] = [];

	// setupHook: () => any;

	setup(fn: () => any) {
		// this.setupHook = fn;
	}

	add(name: string, fn: BenchmarkFn) {
		this.benchmarks.push({ name, fn });
	}
}

type ParamsConfig = Record<string, any[]>;

export function createParamsIter(config: ParamsConfig) {
	type ParamList = Array<[string, any[]]>;

	function* cartesian(ctx: object, array: ParamList): Iterable<object> {
		const [head, ...tail] = array;
		const remainder = tail.length > 0 ? cartesian(ctx, tail) : [{}];
		const [key, values] = head;
		for (let r of remainder) for (let v of values) yield { ...r, [key]: v };
	}

	return cartesian({}, Object.entries(config));
}

export async function getIterations(fn: BenchmarkFn, threshold: number) {
	let count = 1;
	let time = 0;

	let start = performance.now();
	while (time < threshold) {
		for (let i = 0; i < count; i++) {
			await Promise.resolve(fn());
		}
		count *= 2;
		time = performance.now() - start;
	}

	return count / 2;
}

export function add(suite: BenchmarkSuite) {

}
