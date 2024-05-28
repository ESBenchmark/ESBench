import { mkdirSync, rmSync } from "fs";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { afterAll, afterEach, beforeAll, beforeEach, Mock, vi } from "vitest";
import { BenchmarkSuite } from "../src/suite.ts";
import { MetricAnalysis, Profiler, ProfilingContext } from "../src/profiling.ts";
import { ClientMessage, messageResolver, ToolchainResult } from "../src/connect.ts";
import { RE_ANY } from "../src/utils.ts";
import { ExecuteOptions, Executor } from "../src/host/index.ts";

export type PartialSuite<T extends CPSrcObject = any> = Partial<BenchmarkSuite<T>>;

export const resultStub: ToolchainResult = {
	paramDef: [],
	notes: [],
	meta: {
		time: {
			format: "{duration.ms}",
			key: "time",
			analysis: MetricAnalysis.Statistics,
			lowerIsBetter: true,
		},
	},
	scenes: [{
		foo: { time: [0, 1, 1, 1] },
		bar: { time: [1, 2, 2, 2] },
	}],
};

/**
 * setTimeout() has a large error, so we use a synchronized loop for delay.
 *
 * @param ms Delay time, in milliseconds.
 */
export function spin(ms = 1) {
	// noinspection StatementWithEmptyBodyJS
	for (let s = performance.now(), e = s; e - s < ms; e = performance.now()) ;
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

export function runProfilers(profilers: Profiler[], suite?: PartialSuite) {
	const normalized: BenchmarkSuite = {
		setup: scene => scene.bench("Test", noop),
		...suite,
	};
	const runOptions = { log: noop };
	const context = new ProfilingContext(normalized, profilers, runOptions);
	return context.run().then(() => context);
}

// Use shared folder may cause tests to fail randomly with parallel execution.
const BUILD_OUT_DIR = ".esbench-test-temp";

export function executorTester(executor: Executor) {
	useTempDirectory(BUILD_OUT_DIR);
	beforeAll(() => executor.start?.() as any);
	afterAll(() => executor.close?.() as any);

	return async (build: any) => {
		const context = messageResolver(noop) as unknown as ExecuteOptions;
		context.tempDir = BUILD_OUT_DIR;
		context.pattern = RE_ANY.source;
		context.root = build.root;
		context.files = build.files;
		vi.spyOn(context, "dispatch");

		const w = executor.execute(context);
		await Promise.all([context.promise, w]);

		return context.dispatch as Mock<[ClientMessage, ...unknown[]]>;
	};
}

export const executorFixtures = {

	empty: [{ paramDef: [], meta: {}, notes: [], scenes: [] }],

	log: { level: "info", log: "log message" },

	error: new Error("Stub Error"),
};
