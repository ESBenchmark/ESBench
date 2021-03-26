import { performance } from "perf_hooks";

const NOOP = () => {};

export type BenchmarkFn = () => any;

interface BenchmarkCase {
	name: string;
	async: boolean;
	fn: BenchmarkFn;
}

export class BenchmarkSuite {

	readonly benchmarks: BenchmarkCase[] = [];

	setupHook: () => any = NOOP;
	teardownHook: () => any = NOOP;

	beforeAll(fn: () => any) {
		this.setupHook = fn;
	}

	afterAll(fn: () => any) {
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

export function createParamsIter(config: ParamsConfig) {
	type ParamList = Array<[string, any[]]>;

	function* cartesian(ctx: object, array: ParamList): Iterable<object> {
		const [head, ...tail] = array;
		const remainder = tail.length > 0 ? cartesian(ctx, tail) : [{}];
		const [key, values] = head;

		if (values.length === 0) {
			throw new Error("Parameter list cannot be empty");
		} else {
			for (const r of remainder)
				for (const v of values)
					yield { ...r, [key]: v };
		}
	}

	const kvs = Object.entries(config);
	return kvs.length === 0 ? [{}] : cartesian({}, kvs);
}

type IterateFn = (count: number) => Promise<number>;

function runSync(fn: BenchmarkFn, count: number) {
	const start = performance.now();
	for (let i = 0; i < count; i++) {
		fn();
	}
	return Promise.resolve(performance.now() - start);
}

async function runAsync(fn: BenchmarkFn, count: number) {
	const start = performance.now();
	for (let i = 0; i < count; i++) {
		await Promise.resolve(fn());
	}
	return performance.now() - start;
}

export async function getIterations(fn: IterateFn, threshold: number) {
	let count = 1;
	let time = 0;

	while (time < threshold) {
		time = await fn(count);
		count *= 2;
		console.log(count);
	}

	return count / 2;
}

type MainFn = (suite: BenchmarkSuite, config: object) => void;

export async function create(paramConfig: ParamsConfig, mainFn: MainFn) {
	paramConfig ??= {};

	for (const config of createParamsIter(paramConfig)) {
		const suite = new BenchmarkSuite();
		mainFn(suite, config);

		suite.setupHook();
		for (const case_ of suite.benchmarks) {
			const runFn = (case_.async ? runAsync : runSync).bind(null, case_.fn);
			const count = await getIterations(runFn, 10_000);

			const times: number[] = [];
			for (let i = 0; i < 5; i++) {
				times.push(await runFn(count));
			}

			const mean = times.reduce((s, c) => s + c, 0) / times.length;
			console.log(mean.toFixed(3) + " ms");
		}
		suite.teardownHook();
	}
}
