import { performance } from "perf_hooks";

const NOOP = () => {};

export type BenchmarkFn = () => any;

interface BenchmarkCase {
	name: string;
	async: boolean;
	fn: BenchmarkFn;
}

export interface CaseResult {
	name: string;
	time: number;
}

export interface SuiteResult {
	name: string;
	platform: string;
	cases: CaseResult[];
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
	// targets:
}

export type ConfigData = Record<string, any>;

export function createParamsIter(config: ParamsConfig) {
	type ParamList = Array<[string, any[]]>;

	function* cartesian(ctx: ConfigData, array: ParamList): Iterable<ConfigData> {
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

async function getIterations(fn: IterateFn, threshold: number) {
	let count = 1;
	let time = 0;

	while (time < threshold) {
		time = await fn(count);
		console.log(`Pilot: ${count} op, ${time.toFixed(2)} ms`);
		count *= 2;
	}

	return count / 2;
}

type MainFn = (suite: BenchmarkContext, config: ConfigData) => void;

interface Channel {

	sendMessage(message: any): void;
}

class NodeProcessRunner {

	sendMessage(message: any) {
		process.send!(message);
	}
}

class BrowserRunner {

	sendMessage(message: any) {
		console.log(message);
	}
}

enum MessageType {
	Log,
	Result,
}

interface Message {
	type: MessageType;
	data: any;
}

async function runSuite(params: ParamsConfig, mainFn: MainFn, channel: Channel) {

	for (const config of createParamsIter(params)) {
		const suite = new BenchmarkContext();
		mainFn(suite, config);

		suite.setupHook();
		for (const case_ of suite.benchmarks) {
			const runFn = (case_.async ? runAsync : runSync).bind(null, case_.fn);

			const count = await getIterations(runFn, 5_000);
			console.log();

			const times: number[] = [];
			for (let i = 0; i < 5; i++) {
				const time = await runFn(count);
				times.push(time);
				console.log(`Actual ${time.toFixed(2)}ms`);
			}

			channel.sendMessage({
				type: MessageType.Result,
				data: times,
			});
			const mean = times.reduce((s, c) => s + c, 0) / times.length / count;
			console.log();
			console.log(mean.toFixed(3) + " ms/op");
		}
		suite.teardownHook();
	}
}

export async function create(options: SuiteOptions, mainFn: MainFn) {
	options.params ??= {};

	if (typeof window !== "undefined") {
		return runSuite(options.params, mainFn, new BrowserRunner());
	} else if (process.env.BENCHMARK_CHILD) {
		return runSuite(options.params, mainFn, new NodeProcessRunner());
	} else {
		return options;
	}
}
