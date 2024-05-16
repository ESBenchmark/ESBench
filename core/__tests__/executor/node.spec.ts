import { expect, it } from "vitest";
import NodeExecutor from "../../src/executor/node.js";
import { executorFixtures, executorTester } from "../helper.ts";

const execute = executorTester(new NodeExecutor());

it("should have a name", () => {
	expect(new NodeExecutor()).toHaveProperty("name", "node");
});

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
	return expect(promise).rejects.toThrow("Node execute Failed (1), args=[]");
});
