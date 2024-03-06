import { mkdirSync, rmSync } from "fs";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { afterEach, beforeEach, Mock, vi } from "vitest";
import { BenchmarkSuite, ClientMessage, Profiler, ProfilingContext, runSuite, RunSuiteOption } from "../src/index.js";
import { Executor } from "../src/host/index.ts";
import { newExecuteContext } from "../src/host/host.ts";

export type PartialSuite<T extends CPSrcObject = any> = Partial<BenchmarkSuite<T>>;

/**
 * setTimeout() has a large error, so we use a synchronized loop for delay.
 */
export function spin1ms() {
	// noinspection StatementWithEmptyBodyJS
	for (let s = performance.now(), e = s; e - s < 1; e = performance.now());
}

/**
 * Ensure the directory exists before tests and delete it after.
 *
 * @param path A path to a directory
 */
export function useTempDirectory(path: string) {
	beforeEach(() => {
		mkdirSync(path, { recursive: true });
	});
	afterEach(() => {
		rmSync(path, { force: true, recursive: true });
	});
}

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

const BUILD_OUT_DIR = ".esbench-temp-test";

export async function testExecute(executor: Executor, build: any) {
	const context = newExecuteContext(BUILD_OUT_DIR, build, {});
	context.dispatch = vi.fn(context.dispatch);

	mkdirSync(BUILD_OUT_DIR, { recursive: true });
	await executor.start?.();
	try {
		const w = executor.execute(context);
		await Promise.all([context.promise, w]);
	} finally {
		await executor.close?.();
		rmSync(BUILD_OUT_DIR, { force: true, recursive: true });
	}
	return context.dispatch as Mock<[ClientMessage, ...any[]]>;
}

export const executorFixtures = {

	empty: [{ name: "Test", paramDef: [], meta: {}, notes: [], scenes: [] }],

	log: { level: "info", log: "log message" },

	error: new Error("Stub Error"),
};
