import { describe, expect, it } from "vitest";
import { chromium, firefox, webkit } from "playwright-core";
import { executorTester } from "../helper.ts";
import { PlaywrightExecutor, WebextExecutor } from "../../src/executor/playwright.ts";
import { RunSuiteResult } from "../../src/index.ts";

it.each([
	[new PlaywrightExecutor(firefox), "firefox"],
	[new PlaywrightExecutor(webkit), "webkit"],
	[new PlaywrightExecutor(chromium), "chromium"],
	[new WebextExecutor(chromium), "chromium addon"],
])("should suggest a name %#", (executor, name) => {
	expect(executor.name).toBe(name);
});

describe("PlaywrightExecutor", () => {
	const tester = executorTester(new PlaywrightExecutor(chromium));

	it("should transfer messages", tester.successCase());

	it("should forward errors from runAndSend()", tester.insideError());

	it("should forward top level errors", tester.outsideError());

	it("should respond 404 when resource not exists", async () => {
		const dispatch = await tester.execute({
			files: ["./foo.js"],
			root: "__tests__/fixtures/fetch-404",
		});
		const [result] = dispatch.mock.calls[0][0] as RunSuiteResult[];
		expect(result.notes[0].text).toBe("Status: 404");
	});

	it("should support import JSON modules", async () => {
		const dispatch = await tester.execute({
			files: ["./foo.js"],
			root: "__tests__/fixtures/import-assertion",
		});
		expect(dispatch.mock.calls[0][0]).toStrictEqual([{ hello: "world" }]);
	});
});

describe("WebextExecutor", () => {
	const tester = executorTester(new WebextExecutor(chromium));

	it("should check browser type that can only be chromium", () => {
		expect(() => new WebextExecutor(firefox)).toThrow();
	});

	it("should run suites with extension API access", async () => {
		const dispatch = await tester.execute({
			files: ["./foo.js"],
			root: "__tests__/fixtures/webext",
		});
		const [result] = dispatch.mock.calls[0][0] as any;
		expect(result.info).toHaveProperty("active", true);
	});
});
