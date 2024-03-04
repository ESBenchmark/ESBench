import { expect, it } from "vitest";
import { executorFixtures, testExecute } from "../helper.ts";
import direct from "../../src/executor/direct.ts";

it("should transfer log messages", async () => {
	const dispatch = await testExecute(direct, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/success-suite",
	});

	const { calls } = dispatch.mock;
	expect(calls).toHaveLength(2);
	expect(calls[0][0]).toStrictEqual(executorFixtures.log);
	expect(calls[1][0]).toStrictEqual(executorFixtures.empty);
});

it("should forward errors from connect()", async () => {
	const promise = testExecute(direct, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-inside",
	});
	await expect(promise).rejects.toThrow(executorFixtures.error);
});

it("should throw error if exception occurred outside connect()", () => {
	const promise = testExecute(direct, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-outside",
	});
	return expect(promise).rejects.toThrow("Stub Error");
});
