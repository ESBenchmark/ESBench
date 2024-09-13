import { mkdirSync, rmSync } from "node:fs";
import { Awaitable, CPSrcObject, firstItem, noop } from "@kaciras/utilities/browser";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import chalk from "chalk";
import { BenchmarkSuite, normalizeSuite } from "../src/suite.ts";
import { MetricAnalysis, Profiler, ProfilingContext } from "../src/profiling.ts";
import { RunSuiteResult } from "../src/runner.ts";
import { ClientMessage, messageResolver, ToolchainResult } from "../src/connect.ts";
import { RE_ANY } from "../src/utils.ts";
import { Executor, HostContext } from "../src/host/index.ts";

// Enforce colored console output on CI.
chalk.level = 1;

export type PartialSuite<T extends CPSrcObject = any> = Partial<BenchmarkSuite<T>>;

export const resultStub: ToolchainResult = {
	name: "suite.js",
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

export const emptySuite = {
	setup: noop,
	params: [],
	paramNames: [],
};

export function runProfilers(profilers: Profiler[], suite?: PartialSuite) {
	const normalized = normalizeSuite({
		setup: scene => scene.bench("Test", noop),
		...suite,
	});
	const runOptions = { log: noop };
	const context = new ProfilingContext(normalized, profilers, runOptions);
	return context.run().then(() => context);
}

function factory<T extends any[]>(f: (...args: T) => unknown) {
	return (...args: T) => () => f(...args);
}

// Use shared folder may cause tests to fail randomly with parallel execution.
const BUILD_OUT_DIR = ".build-tmp";

const logMessage = { level: "info", log: "log message" };
const emptyResult = { paramDef: [], meta: {}, notes: [], scenes: [] };
const stubError = new Error("Stub Error");

export interface TestExecuteSuccessMessages {
	logs: ClientMessage[];
	result: RunSuiteResult & Record<string, any>;
}

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
	const context = new HostContext({ logLevel: "off", tempDir: BUILD_OUT_DIR });

	useTempDirectory(BUILD_OUT_DIR);
	beforeAll(() => executor.start?.(context) as Awaitable<void>);
	afterAll(() => executor.close?.(context) as Awaitable<void>);

	let execute = async (fixture: string, file = "./suite.js") => {
		const resolver = messageResolver(noop);
		const { calls } = vi.spyOn(resolver, "dispatch").mock;

		const execution = executor.execute({
			...resolver,
			file: file,
			root: `__tests__/fixtures/${fixture}`,
			pattern: RE_ANY.source,
		});

		await Promise.all([resolver.promise, execution]);

		// Filter out redundant arguments.
		const result = calls.pop()![0];
		const logs = calls.map(firstItem);
		return { logs, result } as TestExecuteSuccessMessages;
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
			const msg1 = await execute("success-suite");
			expect(msg1).toStrictEqual({ logs: [logMessage], result: emptyResult });

			const msg2 = await execute("success-suite");
			expect(msg2).toStrictEqual({ logs: [logMessage], result: emptyResult });
		}),

		importJSON: factory(async () => {
			const msg = await execute("import-assertion");
			expect(msg.result).toHaveProperty("hello", "world");
		}),

		insideError: factory(() => {
			return expect(execute("error-inside")).rejects.toThrow(stubError);
		}),

		outsideError: factory((error = stubError.message) => {
			return expect(execute("error-outside")).rejects.toThrow(error);
		}),
	};
}
