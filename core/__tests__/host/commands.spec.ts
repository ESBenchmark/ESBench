import { exposeGC, noop } from "@kaciras/utilities/node";
import { expect, it, vi } from "vitest";
import JobGenerator, { Executor } from "../../src/host/toolchain.ts";
import { HostContext } from "../../src/host/context.ts";
import { report, start } from "../../src/host/commands.ts";
import { resultStub } from "../helper.ts";
import result1And2 from "../fixtures/merged-1+2.json" with { type: " json" };

exposeGC();

it("should throw error when report a non-exists result", () => {
	return expect(report({}, ["NOT_EXISTS.json"])).rejects.toThrow();
});

it("should merge results", async () => {
	const mockReporter = vi.fn();

	await report({
		reporters: [mockReporter],
	}, [
		"__tests__/fixtures/merge-*.json",
	]);

	const { calls } = mockReporter.mock;
	expect(calls).toHaveLength(1);
	expect(calls[0][0]).toStrictEqual(result1And2);
});

it("should check for no file matches", () => {
	const promise = report({}, ["__tests__/fixtures/NOT_EXISTS.json"]);
	return expect(promise).rejects.toThrow("No file match the glob patterns.");
});

it("should add tools and tags to results", async () => {
	const execute = vi.fn(task => task.dispatch(resultStub));
	const report = vi.fn();

	vi.spyOn(JobGenerator, "generate").mockResolvedValue([{
		name: "mock-executor",
		executor: {
			name: "UNUSED",
			execute,
		},
		builds: [{
			name: "mock-builder",
			root: "root",
			files: ["./suite.js"],
		}],
	}]);

	await start({
		tags: { foo: "11" },
		logLevel: "off",
		reporters: [report],
	});

	const [results] = report.mock.calls[0];
	const result0 = results["suite.js"][0];
	expect(result0.tags).toStrictEqual({ foo: "11" });
	expect(result0.builder).toBe("mock-builder");
	expect(result0.executor).toStrictEqual("mock-executor");
});

it("should warning if no job to run", async () => {
	const report = vi.fn();
	const warn = vi.spyOn(HostContext.prototype, "warn").mockImplementation(noop);
	vi.spyOn(JobGenerator, "generate").mockResolvedValue([]);

	await start({ reporters: [report] });

	expect(report).not.toHaveBeenCalled();
	expect(warn).toHaveBeenCalledWith("\nNo file match the includes, please check your config.");
});

it("should ensure `Executor.close` called after finish", async () => {
	vi.spyOn(HostContext.prototype, "info").mockImplementation(noop);
	const mockExecutor = {
		name: "mock-executor",
		start: vi.fn(),
		close: vi.fn(),
		execute: vi.fn(() => {throw new Error("Stub");}),
	};
	vi.spyOn(JobGenerator, "generate").mockResolvedValue([{
		name: "foo",
		executor: mockExecutor,
		builds: [{
			name: "mock-builder",
			root: "root",
			files: ["./suite.js"],
		}],
	}]);

	await expect(start({})).rejects.toThrow();

	expect(mockExecutor.close).toHaveBeenCalledOnce();
	expect(mockExecutor.execute).toHaveBeenCalledOnce();
});


/*
 * V8's gc is not guaranteed to be completely cleaned up,
 * this test may still randomly fail.
 */
it("should prevent memory grown of large result set", async () => {
	let before = 0;
	let after = 0;

	gc!();

	const mockExecutor: Executor = {
		name: "test-mock-executor",
		start() {
			before = process.memoryUsage().heapUsed;
		},
		execute(task) {
			task.dispatch(resultStub);
		},
		close() {
			gc!();
			after = process.memoryUsage().heapUsed;
		},
	};
	const mockBuildArray: any = {
		name: "mock-builder",
		root: "root",
		files: ["./suite.js"],

		length: 100_000,
		index: 0,

		* [Symbol.iterator]() {
			while (++this.index < this.length) yield this;
		},
	};

	vi.spyOn(JobGenerator, "generate").mockResolvedValue([{
		name: "foo",
		executor: mockExecutor,
		builds: mockBuildArray,
	}]);

	await start({ reporters: [], logLevel: "off" });

	expect(after - before).toBeLessThan(5 * 1048576);
});
