import { Awaitable, cartesianObject, durationFmt } from "@kaciras/utilities/browser";
import { BenchmarkCase, Scene, BenchmarkModule, HookFn } from "./suite.js";
import { MessageType, serializable, WorkerMessage } from "./message.js";

export type Channel = (message: WorkerMessage) => Awaitable<void>;

type IterateFn = (count: number) => Awaitable<number>;

function runHooks(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

function createRunner(ctx: Scene, case_: BenchmarkCase) {
	const { workload, isAsync } = case_;
	const { setupIteration, cleanIteration } = ctx;

	async function noSetup(count: number) {
		const start = performance.now();
		if (isAsync) {
			while (count-- > 0) await workload();
		} else {
			while (count-- > 0) workload();
		}
		return performance.now() - start;
	}

	async function syncWithSetup(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runHooks(setupIteration);

			timeUsage -= performance.now();
			workload();
			timeUsage += performance.now();

			await runHooks(cleanIteration);
		}
		return timeUsage;
	}

	async function asyncWithSetup(count: number) {
		let timeUsage = 0;
		while (count-- > 0) {
			await runHooks(setupIteration);

			timeUsage -= performance.now();
			await workload();
			timeUsage += performance.now();

			await runHooks(cleanIteration);
		}
		return timeUsage;
	}

	const setup = setupIteration.length && cleanIteration.length;
	return setup ? isAsync ? asyncWithSetup : syncWithSetup : noSetup;
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

	private readonly suite: BenchmarkModule<any>;
	private readonly channel: Channel;

	constructor(suite: BenchmarkModule<any>, channel: Channel) {
		this.suite = suite;
		this.channel = channel;
	}

	async bench(file: string, name?: string) {
		const { params = {}, main } = this.suite;

		await this.channel({
			type: MessageType.Suite,
			file,
			paramDefs: serializable(params),
		});

		for (const config of cartesianObject(params)) {
			const context = new Scene();
			await main(context, config);

			await this.channel({
				type: MessageType.Scene,
				params: config,
			});

			for (const case_ of context.benchmarks) {
				if (name && case_.name !== name) {
					continue;
				}
				await this.run(context, case_);
			}
			await runHooks(context.cleanEach);
		}
	}

	private async run(context: Scene, case_: BenchmarkCase) {
		const { samples = 5, iterations = 10_000 } = this.suite.options;
		const { name } = case_;

		const runFn = createRunner(context, case_);

		// noinspection SuspiciousTypeOfGuard (false positive)
		const count = typeof iterations === "number"
			? iterations
			: await getIterations(runFn, durationFmt.parse(iterations, "ms"));

		console.log("Count:" + count);

		const metrics: Record<string, any[]> = { time: [] };
		for (let i = 0; i < samples; i++) {
			metrics.time.push(await runFn(count));
		}

		await this.channel({ type: MessageType.Workload, name, metrics });
	}
}

export type Importer = (path: string) => Awaitable<{ default: BenchmarkModule<any> }>;

export async function runSuites(
	channel: Channel,
	importer: Importer,
	files: string[],
	name?: string,
) {
	for (const file of files) {
		const { default: suite } = await importer(file);
		await new SuiteRunner(suite, channel).bench(file, name);
	}
	await channel({ type: MessageType.Finished });
}
