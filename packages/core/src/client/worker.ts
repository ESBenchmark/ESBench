import { Awaitable, cartesianObject, durationFmt } from "@kaciras/utilities/browser";
import { BenchmarkCase, BenchmarkContext, Workload, MainFn, SuiteOptions, BenchmarkModule } from "./suite.js";
import { WorkerMessage, MessageType, serializable } from "./message.js";

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
			file,
			paramDefs: serializable(params),
		});

		for (const config of cartesianObject(params)) {
			const suite = new BenchmarkContext();
			await this.mainFn(suite, config);

			await this.channel({ type: MessageType.Case, params: config });

			suite.setupEach();
			for (const case_ of suite.benchmarks) {
				if (name && case_.name !== name) {
					continue;
				}
				await this.run(case_);
			}
			suite.cleanEach();
		}
	}

	private async run(case_: BenchmarkCase) {
		const { turns = 5, iterations = 10_000 } = this.options;
		const { name, workload, async } = case_;

		const runFn: IterateFn = async
			? runAsync.bind(null, workload)
			: runSync.bind(null, workload);

		// noinspection SuspiciousTypeOfGuard (false positive)
		const count = typeof iterations === "number"
			? iterations
			: await getIterations(runFn, durationFmt.parse(iterations, "ms"));

		console.log("Count:" + count);

		const metrics: Record<string, any[]> = { time: [] };

		for (let i = 0; i < turns; i++) {
			metrics.time.push(await runFn(count));
		}

		await this.channel({ type: MessageType.Workload, name, metrics });
	}
}

export type Importer = (path: string) => Awaitable<{ default: BenchmarkModule }>;

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
