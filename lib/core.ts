import { performance } from "perf_hooks";
import parseDuration from "parse-duration";
import { createParamsIter } from "./utils.js";
import { BenchmarkContext, BenchmarkFn, SuiteOptions } from "./builder.js";

export type ConfigData = Record<string, any>;

type IterateFn = (count: number) => Promise<number>;

function runSync(fn: BenchmarkFn, count: number) {
	const start = performance.now();
	while (count-- > 0) {
		fn();
	}
	return performance.now() - start;
}

async function runAsync(fn: BenchmarkFn, count: number) {
	const start = performance.now();
	while (count-- > 0) {
		await fn();
	}
	return performance.now() - start;
}

async function getIterations(fn: IterateFn, targetMS: number) {
	let count = 1;
	let time = 0;

	while (time < targetMS) {
		time = await fn(count);
		console.log(`Pilot: ${count} op, ${time.toFixed(2)} ms`);
		count *= 2;
	}
	return Math.ceil(count / 2 * targetMS / time);
}

export interface SuiteResult {
	file: string;
	platform: string;
	cases: CaseResult[];
}

export interface CaseResult {
	type: MessageType.Result;
	name: string;
	times: number[];
	iterations: number;
}

export interface Channel {

	sendMessage(message: any): void;
}


enum MessageType {
	Log,
	Result,
}

interface Message {
	type: MessageType;
	data: any;
}

export function bench() {

}

export async function runSuite(options: SuiteOptions, mainFn: MainFn, channel: Channel) {
	const { params = {}, time = 5, iterations = 10_000 } = options;

	for (const config of createParamsIter(params)) {
		const suite = new BenchmarkContext();
		await mainFn(suite, config);

		suite.setupHook();
		for (const case_ of suite.benchmarks) {
			const runFn = (case_.async ? runAsync : runSync).bind(null, case_.fn);

			const count = typeof iterations === "number"
				? iterations
				: await getIterations(runFn, parseDuration(iterations));

			console.log("Count:" + count);

			const times: number[] = [];
			for (let i = 0; i < time; i++) {
				const time = await runFn(count);
				times.push(time);
				console.log(`Actual ${time.toFixed(2)}ms`);
			}

			channel.sendMessage({
				type: MessageType.Result,
				name: case_.name,
				times,
				iterations,
			});
		}
		suite.teardownHook();
	}
}
