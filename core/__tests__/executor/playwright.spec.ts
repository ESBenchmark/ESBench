import { expect, it } from "vitest";
import { firefox } from "playwright-core";
import { executorFixtures, testExecute } from "../helper.ts";
import { PlaywrightExecutor } from "../../src/executor/playwright.ts";
import { RunSuiteResult } from "../../src/index.ts";

const executor = new PlaywrightExecutor(firefox);

it("should work", async () => {
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
	const promise = testExecute(executor, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-inside",
	});
	await expect(promise).rejects.toThrow(executorFixtures.error);
});

it("should throw error if exception occurred outside runAndSend()", () => {
	const promise = testExecute(executor, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/error-outside",
	});
	return expect(promise).rejects.toThrow("Stub Error");
});

it("should respond 404 when resource not exists", async () => {
	const dispatch = await testExecute(executor, {
		files: ["./foo.js"],
		root: "__tests__/fixtures/fetch-404",
	});
	const [result] = dispatch.mock.calls[0][0] as RunSuiteResult[];
	expect(result.notes[0].text) .toBe("Status: 404");
});
