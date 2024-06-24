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

describe.each([firefox, webkit, chromium])("PlaywrightExecutor %#", type => {
	const tester = executorTester(new PlaywrightExecutor(type));

	// Browser launches slowly on CI.
	it("should transfer messages", { timeout: 75000 }, tester.successCase());

	it("should forward errors from runAndSend()", tester.insideError());

	it("should forward top level errors", tester.outsideError());

	it("should respond 404 when resource not exists", async () => {
		const dispatch = await tester.execute("fetch-404");
		const result = dispatch.mock.calls[0][0] as RunSuiteResult;
		expect(result.notes[0].text).toBe("Status: 404");
	});

	// https://caniuse.com/mdn-javascript_statements_import_import_attributes_type_json
	it.skipIf(type.name() === "firefox")
	("should support import attributes", async () => {
		const dispatch = await tester.execute("import-assertion");
		expect(dispatch.mock.calls[0][0]).toHaveProperty("hello", "world");
	});
});

describe("WebextExecutor", () => {
	const tester = executorTester(new WebextExecutor(chromium));

	it("should check browser type that can only be chromium", () => {
		expect(() => new WebextExecutor(firefox)).toThrow();
	});

	it("should run suites with extension API access", async () => {
		const dispatch = await tester.execute("webext");
		const result = dispatch.mock.calls[0][0] as any;
		expect(result.info).toHaveProperty("active", true);
	});
});
