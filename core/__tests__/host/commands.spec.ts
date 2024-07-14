import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/node";
import { report, start } from "../../src/host/commands.ts";
import JobGenerator from "../../src/host/toolchain.ts";
import { resultStub } from "../helper.ts";
import result1And2 from "../fixtures/merged-1+2.json" with { type: " json" };
import { HostContext } from "../../src/host/index.ts";

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

it("should check for no file matches",  () => {
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

it("should warning if no job to run",async () => {
	const report = vi.fn(noop);
	const warn = vi.spyOn(HostContext.prototype, "warn");
	vi.spyOn(JobGenerator, "generate").mockResolvedValue([]);

	await start({ reporters: [report] });

	expect(report).not.toHaveBeenCalled();
	expect(warn).toHaveBeenCalledWith("\nNo file match the includes, please check your config.");
});
