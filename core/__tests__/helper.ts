import { mkdirSync, rmSync } from "fs";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { afterEach, beforeEach, Mock, vi } from "vitest";
import { BenchmarkSuite } from "../src/suite.ts";
import { Profiler, ProfilingContext } from "../src/context.ts";
import { ClientMessage, messageResolver, runSuite } from "../src/runner.ts";
import { RE_ANY } from "../src/utils.ts";
import { ExecuteOptions, Executor } from "../src/host/index.ts";

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
	suite.setup ??= noop;
	suite.timing = {
		iterations: 1,
		samples: 1,
		warmup: 0,
		unrollFactor: 1,
		...(suite.timing as any),
	};
	return runSuite(suite as any, { log: noop, pattern });
}

export function runProfilers(profilers: Profiler[], suite?: PartialSuite) {
	const normalized: BenchmarkSuite = {
		name: "Test Suite",
		setup: scene => scene.bench("Test", noop),
		...suite,
	};
	const runOptions = { log: noop };
	const context = new ProfilingContext(normalized, profilers, runOptions);
	return context.run().then(() => context);
}

// Use shared folder may cause tests to fail randomly with parallel execution.
const BUILD_OUT_DIR = ".esbench-test-temp";

export async function testExecute(executor: Executor, build: any) {
	const context = messageResolver(noop) as unknown as ExecuteOptions;
	context.tempDir = BUILD_OUT_DIR;
	context.pattern = RE_ANY.source;
	context.root = build.root;
	context.files = build.files;
	vi.spyOn(context, "dispatch");

	mkdirSync(context.tempDir, { recursive: true });
	await executor.start?.();
	try {
		const w = executor.execute(context);
		await Promise.all([context.promise, w]);
	} finally {
		await executor.close?.();
		rmSync(context.tempDir, { recursive: true });
	}

	return context.dispatch as Mock<[ClientMessage, ...any[]]>;
}

export const executorFixtures = {

	empty: [{ name: "Test", paramDef: [], meta: {}, notes: [], scenes: [] }],

	log: { level: "info", log: "log message" },

	error: new Error("Stub Error"),
};
