import tp from "timers/promises";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { BenchmarkSuite, Profiler, ProfilingContext, runSuite, RunSuiteOption } from "../src/index.js";

export type PartialSuite<T extends CPSrcObject = any> = Partial<BenchmarkSuite<T>>;

export const sleep1 = tp.setTimeout.bind(null, 1);

export function run<T extends CPSrcObject>(suite: PartialSuite<T>, pattern?: RegExp) {
	suite.name ??= "Test Suite";
	suite.timing = {
		iterations: 1,
		samples: 1,
		warmup: 0,
		unrollFactor: 1,
		...(suite.timing as any),
	};
	return runSuite(suite as any, { log: noop, pattern });
}

export function runProfilers(profilers: Profiler[], suite?: PartialSuite, options?: RunSuiteOption) {
	const normalized: BenchmarkSuite = {
		name: "Test Suite",
		setup: scene => scene.bench("Test", noop),
		...suite,
	};
	const runOptions = { log: noop, ...options };
	const context = new ProfilingContext(normalized, profilers, runOptions);
	return context.run().then(() => context);
}
