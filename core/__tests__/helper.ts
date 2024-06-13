import { mkdirSync, rmSync } from "fs";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { afterAll, afterEach, beforeAll, beforeEach, expect, Mock, vi } from "vitest";
import chalk from "chalk";
import { BenchmarkSuite } from "../src/suite.ts";
import { MetricAnalysis, Profiler, ProfilingContext } from "../src/profiling.ts";
import { ClientMessage, messageResolver, ToolchainResult } from "../src/connect.ts";
import { RE_ANY } from "../src/utils.ts";
import { ExecuteOptions, Executor, HostContext } from "../src/host/index.ts";
import { BuildResult } from "../src/host/toolchain.ts";

// Enforce colored console output on CI.
chalk.level = 1;

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

function factory<T extends any[]>(f: (...args: T) => unknown) {
	return (...args: T) => () => f(...args);
}

// Use shared folder may cause tests to fail randomly with parallel execution.
const BUILD_OUT_DIR = ".esbench-tmp";

const logMessage = { level: "info", log: "log message" };
const emptyResults = [{ paramDef: [], meta: {}, notes: [], scenes: [] }];
const stubError = new Error("Stub Error");

/**
 * Utility design to run an Executor, it only calls `start` once to make tests faster.
 * If there are multiple executors, each one should be wrapped with a `describe` block.
 *
 * @example
 * const tester = executorTester(executor);
 * it("should 1", () => tester.execute(...));
 * it("should 2", () => tester.execute(...));
 *
 * describe("Executor 2", () => {
 *     const tester = executorTester(executor2);
 *     // Test cases...
 * });
 *
 * @param executor The Executor instance to tested.
 */
export function executorTester(executor: Executor) {
	const context = new HostContext({ logLevel: "off" });

	useTempDirectory(BUILD_OUT_DIR);
	beforeAll(() => executor.start?.(context) as any);
	afterAll(() => executor.close?.(context) as any);

	let execute = async (build: Omit<BuildResult, "name">) => {
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

	return {
		// Use getter/setter to make it overrideable.
		get execute() { return execute; },
		set execute(value) { execute = value; },

		/*
		 * Shared test cases, they should be passed for every executor.
		 *
		 * @example
		 * it("should transfer messages", tester.successCase());
		 * it("should forward errors from runAndSend()", tester.insideError());
		 * it("should forward top level errors", tester.outsideError("message"));
		 */

		successCase: factory(async () => {
			const dispatch = await execute({
				files: ["./foo.js"],
				root: "__tests__/fixtures/success-suite",
			});
			const { calls } = dispatch.mock;
			expect(calls).toHaveLength(2);
			expect(calls[0][0]).toStrictEqual(logMessage);
			expect(calls[1][0]).toStrictEqual(emptyResults);
		}),

		insideError: factory(() => {
			const promise = execute({
				files: ["./foo.js"],
				root: "__tests__/fixtures/error-inside",
			});
			return expect(promise).rejects.toThrow(stubError);
		}),

		outsideError: factory((error = stubError.message) => {
			const promise = execute({
				files: ["./foo.js"],
				root: "__tests__/fixtures/error-outside",
			});
			return expect(promise).rejects.toThrow(error);
		}),
	};
}
