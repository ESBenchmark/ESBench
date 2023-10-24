import { Awaitable, cartesianObject, CPSrcObject, durationFmt, ellipsis, noop } from "@kaciras/utilities/browser";
import { BenchmarkCase, BenchmarkSuite, CheckEquality, HookFn, Scene, SuiteConfig } from "./suite.js";

function toDisplay(v: unknown, i: number) {
	switch (typeof v) {
		case "object":
			return v === null ? "null" : `object #${i}`;
		case "symbol":
			return v.description
				? `symbol(${ellipsis(v.description, 10)}) #${i}`
				: `symbol #${i}`;
		case "function":
			return `func ${ellipsis(v.name, 10)} #${i}`;
		default:
			return ellipsis("" + v, 16) + `#${i}`;
	}
}

function serializable(params: CPSrcObject) {
	const entries = Object.entries(params);
	const processed: Record<string, string[]> = {};
	let length = 0;
	let current: string[];

	for (let i = 0; i < entries.length; i++) {
		const [key, values] = entries[i];
		processed[key] = current = [];

		for (const v of values) {
			const k = current.length;
			current.push(toDisplay(v, k));
		}

		length += current.length;
	}

	return { length, processed };
}

type IterateFn = (count: number) => Awaitable<number>;

function runHooks(hooks: HookFn[]) {
	return Promise.all(hooks.map(hook => hook()));
}

function createInvoker(ctx: Scene, case_: BenchmarkCase) {
	const { workload, isAsync } = case_;
	const { setupIteration, cleanIteration } = ctx;

	async function invoke() {
		await runHooks(setupIteration);
		const returnValue = await workload();
		await runHooks(cleanIteration);
		return returnValue;
	}

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
	const iterate: IterateFn = setup
		? isAsync
			? asyncWithSetup : syncWithSetup : noSetup;

	return { run: invoke, iterate, name: case_.name };
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

type ParamDefs = Record<string, any[]>;
export type Metrics = Record<string, any[]>;

type WorkloadResult = [string, Metrics];

export type SuiteResult = {
	paramDef: ParamDefs;
	scenes: WorkloadResult[][];
};

type Logger = (message: string) => void;

interface BenchmarkWorker {

	onScene(scene: Scene): Awaitable<void>;

	onCase(scene: Scene, case_: BenchmarkCase): Awaitable<void>;
}

class Validator implements BenchmarkWorker {

	private static NONE = Symbol();

	private readonly isEqual: CheckEquality;

	private value: any = Validator.NONE;

	constructor(isEqual: CheckEquality) {
		this.isEqual = isEqual;
	}

	onScene = noop;

	async onCase(scene: Scene, case_: BenchmarkCase) {
		const { value, isEqual } = this;
		const { run } = createInvoker(scene, case_);

		if (value === Validator.NONE) {
			this.value = await run();
		} else if (!isEqual(value, await run())) {
			const { name } = scene.cases[0];
			throw new Error(`${case_.name} and ${name} returns different value.`);
		}
	}
}

class WorkloadRunner implements BenchmarkWorker {

	private readonly config: SuiteConfig;
	private readonly logger: Logger;
	private readonly total: number;

	scenes: WorkloadResult[][] = [];
	result: WorkloadResult[] = [];

	constructor(config: SuiteConfig, logger: Logger, total: number) {
		this.config = config;
		this.logger = logger;
		this.total = total;
	}

	onScene(scene: Scene) {
		const { scenes, logger, total } = this;
		const { length } = scene.cases;
		const index = scenes.push(this.result = []);

		if (length === 0) {
			logger(`Warning: No workload found from scene #${index}.`);
		} else {
			logger(`Scene ${index} of ${total}, ${length} workloads.`);
		}
	}

	async onCase(scene: Scene, case_: BenchmarkCase) {
		const { samples = 5, iterations = 10_000 } = this.config;
		const { name } = case_;

		const { iterate } = createInvoker(scene, case_);

		// noinspection SuspiciousTypeOfGuard (false positive)
		const count = typeof iterations === "number"
			? iterations
			: await getIterations(iterate, durationFmt.parse(iterations, "ms"));

		this.logger(`Iterations of ${name}: ${count}\n`);

		const metrics: Metrics = { time: [] };
		for (let i = 0; i < samples; i++) {
			const time = await iterate(count);
			metrics.time.push(time);

			const one = time / count;
			this.logger(`Sample ${i}, ${durationFmt.formatDiv(time, "ms")}, ${durationFmt.formatDiv(one, "ms")}/op`);
		}
	}
}

export interface RunSuiteOption {
	logger?: Logger;
	pattern?: RegExp;
}

export async function runSuite(suite: BenchmarkSuite<any>, options: RunSuiteOption) {
	const { main, afterAll = noop, config = {}, params = {} } = suite;
	const logger = options.logger ?? console.log;
	const pattern = options.pattern ?? new RegExp("");

	async function run(action: BenchmarkWorker) {
		for (const comb of cartesianObject(params)) {
			const scene = new Scene();
			await main(scene, comb);
			await action.onScene(scene);

			for (const case_ of scene.cases) {
				if (!pattern.test(case_.name)) {
					continue;
				}
				await action.onCase(scene, case_);
			}
			await runHooks(scene.cleanEach);
		}
	}

	function validate() {
		const { validateExecution, validateReturnValue } = config;

		if (!validateExecution && !validateReturnValue) {
			return;
		}

		let isEqual: CheckEquality;
		if (validateReturnValue === true) {
			isEqual = (a, b) => a === b;
		} else if (validateReturnValue) {
			isEqual = validateReturnValue;
		} else {
			isEqual = () => true;
		}

		return run(new Validator(isEqual));
	}

	await validate();

	const x = serializable(params);
	const workloadRunner = new WorkloadRunner(config, logger, x.length);
	await run(workloadRunner);
	await afterAll();

	return { paramDef: x.processed, scenes: workloadRunner.scenes };
}
