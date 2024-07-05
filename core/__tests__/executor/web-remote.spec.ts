import { afterAll, expect, it } from "vitest";
import { chromium } from "playwright-core";
import WebRemoteExecutor from "../../src/executor/web-remote.ts";
import { executorTester } from "../helper.ts";

const tester = executorTester(new WebRemoteExecutor());

const browser = await chromium.launch();
const context = await browser.newContext();

afterAll(() => browser.close());

const baseExecute = tester.execute;
tester.execute = async build => {
	const page = await context.newPage();
	try {
		await page.goto("http://localhost:14715");
		return await baseExecute(build);
	} finally {
		await page.close();
	}
};

it("should suggest a name", () => {
	expect(new WebRemoteExecutor().name).toBe("web remote");
});

it("should transfer messages", tester.successCase());

it("should forward errors from runAndSend()", tester.insideError());

it("should forward top level errors", tester.outsideError());

it("should support import attributes", tester.importJSON());
