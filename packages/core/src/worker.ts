import { Awaitable, cartesianObject, durationFmt, ellipsis } from "@kaciras/utilities/browser";
import { BenchmarkCase, BenchmarkContext, Workload, MainFn, SuiteOptions, BenchmarkModule } from "./builder.js";

export enum MessageType {
	Suite,
	Case,
	Turn,
	Finished,
}

export interface SuiteMessage {
	type: MessageType.Suite;
	file: string;
	paramDefs: Record<string, any[]>;
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

export interface FinishMessage {
	type: MessageType.Finished;
}

export type WorkerMessage = SuiteMessage | CaseMessage | TurnMessage | FinishMessage;

// =========================================================================

export type Channel = (message: WorkerMessage) => Awaitable<void>;

type IterateFn = (count: number) => Awaitable<number>;

function runSync(fn: Workload, count: number) {
	const start = performance.now();
	while (count-- > 0) {
		fn();
	}
	return performance.now() - start;
}

async function runAsync(fn: Workload, count: number) {
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

export class SuiteRunner {

	private readonly options: SuiteOptions;
	private readonly mainFn: MainFn;
	private readonly channel: Channel;

	constructor(options: SuiteOptions, mainFn: MainFn, channel: Channel) {
		this.options = options;
		this.mainFn = mainFn;
		this.channel = channel;
	}

	async bench(file: string, name?: string) {
		const { params = {} } = this.options;

		await this.channel({
			type: MessageType.Suite,
			paramDefs: serializable(params),
			file,
		});

		for (const config of cartesianObject(params)) {
			const suite = new BenchmarkContext();
			await this.mainFn(suite, config);

			await this.channel({ type: MessageType.Case, params: config });

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
		const { name, workload, async } = case_;

		const runFn: IterateFn = async
			? runAsync.bind(null, workload)
			: runSync.bind(null, workload);

		// noinspection SuspiciousTypeOfGuard (false positive)
		const count = typeof iterations === "number"
			? iterations
			: await getIterations(runFn, durationFmt.parse(iterations, "ms"));

		console.log("Count:" + count);

		for (let i = 0; i < time; i++) {
			const time = await runFn(count);
			await this.channel({ type: MessageType.Turn, name, metrics: { time } });
		}
	}
}

function short(value: any, length: number) {
	if (value.length < length) {
		return value;
	}
	const n = (length - 3) / 2;
	return `${value.slice(0, Math.ceil(n))}...${value.slice(-Math.floor(n))}`;
}

export function serializable(params: Record<string, Iterable<unknown>>) {
	const entries = Object.entries(params);
	const processed: Record<string, any[]> = {};
	const counters = new Array(entries.length).fill(0);

	let current: any[];

	for (let i = 0; i < entries.length; i++) {
		const [key, values] = entries[i];
		processed[key] = current = [];

		for (const v of values) {
			const k = counters[i]++;
			switch (typeof v) {
				case "object":
					current.push(v === null ? "null" : `object #${k}`);
					break;
				case "symbol":
					current.push(v.description
						? `symbol(${short(v.description, 10)}) #${k}`
						: `symbol #${k}`,
					);
					break;
				case "function":
					current.push(`func ${short(v.name, 10)} #${k}`);
					break;
				default:
					current.push(short("" + v, 16));
			}
		}
	}

	return processed;
}

export interface BenchmarkModule {
	default: {
		mainFn: MainFn;
		options: SuiteOptions;
	};
}

export type Importer = (path: string) => Awaitable<BenchmarkModule>;

export default async function runSuites(
	channel: Channel,
	importer: Importer,
	files: string[],
	name?: string,
) {
	for (const file of files) {
		const { default: { options, mainFn } } = await importer(file);
		await new SuiteRunner(options, mainFn, channel).bench(file, name);
	}
	await channel({ type: MessageType.Finished });
}
