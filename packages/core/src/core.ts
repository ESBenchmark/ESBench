import parseDuration from "parse-duration";
import { cartesianProductObj } from "@kaciras/utilities/browser";
import { BenchmarkContext, ParamsConfig } from "./builder.js";

export enum MessageType {
	Turn,
	Case,
	Finished,
}

export interface CaseMessage {
	type: MessageType.Case;
	params: Record<string, any>;
}

export interface TurnMessage {
	type: MessageType.Turn;
	name: string;
	metrics: Record<string, any>;
}

export type Channel = (message: any) => void;

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

export interface SuiteOptions {
	params?: ParamsConfig;
	time?: number;
	iterations?: number | string;
}

type MainFn = (suite: BenchmarkContext, params: ConfigData) => void;

export type ConfigData = Record<string, any>;

export type BenchmarkFn = () => any;

export interface BenchmarkCase {
	name: string;
	async: boolean;
	fn: BenchmarkFn;
}

export class BenchmarkSuite {

	private readonly options: SuiteOptions;
	private readonly mainFn: MainFn;
	private readonly channel: Channel;

	constructor(options: SuiteOptions, mainFn: MainFn, channel: Channel) {
		this.options = options;
		this.mainFn = mainFn;
		this.channel = channel;
	}

	async bench(name?: string) {
		const { params = {} } = this.options;

		for (const config of cartesianProductObj(params)) {
			const suite = new BenchmarkContext();
			await this.mainFn(suite, config);

			this.channel({ type: MessageType.Case, params: config });

			suite.setupHook();
			for (const case_ of suite.benchmarks) {
				if (name && case_.name !== name) {
					continue;
				}
				await this.run(case_);
			}
			suite.teardownHook();
		}
	}

	private async run(case_: BenchmarkCase) {
		const { time = 5, iterations = 10_000 } = this.options;
		const { name, fn, async } = case_;

		const runFn = (async ? runAsync : runSync).bind(null, fn);

		const count = typeof iterations === "number"
			? iterations
			: await getIterations(runFn, parseDuration(iterations));

		console.log("Count:" + count);

		for (let i = 0; i < time; i++) {
			const time = await runFn(count);
			this.channel({ type: MessageType.Turn, name, metrics: { time } });
		}

		this.channel({ type: MessageType.Finished });
	}
}

export interface BenchmarkModule {
	default: MainFn;
	options: SuiteOptions;
}

type Suites = Record<string, () => Promise<BenchmarkModule>>;

export default async function runSuites(suites: Suites, name: string, channel: Channel) {
	for (const [file, import_] of Object.entries(suites)) {
		const { options, default: mainFn } = await import_();
		await new BenchmarkSuite(options, mainFn, channel).bench(name);
	}
}
