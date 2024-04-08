import { expect, it } from "vitest";
import { executorFixtures, testExecute } from "../helper.ts";
import ProcessExecutor from "../../src/executor/process.ts";

it("should transfer log messages", async () => {
	const executor = new ProcessExecutor("node");
	const dispatch = await testExecute(executor, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/success-suite",
	});

	const { calls } = dispatch.mock;
	expect(calls).toHaveLength(2);
	expect(calls[0][0]).toStrictEqual(executorFixtures.log);
	expect(calls[1][0]).toStrictEqual(executorFixtures.empty);
});

it("should forward errors from runAndSend()", async () => {
	const executor = new ProcessExecutor("node");
	const promise = testExecute(executor, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-inside",
	});
	await expect(promise).rejects.toThrow(executorFixtures.error);
});

it("should throw error if exception occurred outside runAndSend()", () => {
	const executor = new ProcessExecutor("node");
	const promise = testExecute(executor, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-outside",
	});
	return expect(promise).rejects.toThrow("Execute Failed (1), Command: node .esbench-test-temp/main.js");
});

it("should suggest the filename as executor name", () => {
	const command = '"/path/to/mock app.sh" -foo --bar';
	expect(new ProcessExecutor(command).name).toBe("mock app.sh");
});

it("should support add arguments", () => {
	const executor = new ProcessExecutor(f => `node --expose_gc ${f} "foo bar"`);
	const promise = testExecute(executor, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-outside",
	});
	return expect(promise).rejects
		.toThrow('Execute Failed (1), Command: node --expose_gc .esbench-test-temp/main.js "foo bar"');
});
