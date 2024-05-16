import { describe, expect, it } from "vitest";
import { executorFixtures, executorTester } from "../helper.ts";
import ProcessExecutor from "../../src/executor/process.ts";

const execute = executorTester(new ProcessExecutor("node"));

it("should transfer log messages", async () => {
	const dispatch = await execute({
		files: ["./foo.js"],
		root: "__tests__/fixtures/success-suite",
	});

	const { calls } = dispatch.mock;
	expect(calls).toHaveLength(2);
	expect(calls[0][0]).toStrictEqual(executorFixtures.log);
	expect(calls[1][0]).toStrictEqual(executorFixtures.empty);
});

it("should forward errors from runAndSend()", async () => {
	const promise = execute({
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-inside",
	});
	await expect(promise).rejects.toThrow(executorFixtures.error);
});

it("should throw error if exception occurred outside runAndSend()", () => {
	const promise = execute({
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-outside",
	});
	return expect(promise).rejects.toThrow("Execute Failed (1), Command: node .esbench-test-temp/main.js");
});

it("should suggest the filename as executor name", () => {
	const command = '"/path/to/mock app.sh" -foo --bar';
	expect(new ProcessExecutor(command).name).toBe("mock app.sh");
});

describe("Custom command line", () => {
	const execute = executorTester(new ProcessExecutor(f => `node --expose_gc ${f} "foo bar"`));

	it("should support add arguments", () => {
		const promise = execute({
			files: ["./foo.js"],
			root: "__tests__/fixtures/error-outside",
		});
		return expect(promise).rejects
			.toThrow('Execute Failed (1), Command: node --expose_gc .esbench-test-temp/main.js "foo bar"');
	});
});
