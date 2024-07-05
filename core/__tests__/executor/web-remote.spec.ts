import { readFileSync } from "fs";
import { afterAll, expect, it, vi } from "vitest";
import { chromium } from "playwright-core";
import WebRemoteExecutor from "../../src/executor/web-remote.ts";
import { executorTester } from "../helper.ts";
import { transformer } from "../../src/executor/transform.ts";

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

it("should transform modules with builtin transformer", async () => {
	const code = readFileSync("__tests__/fixtures/success-suite/index.js", "utf8");
	const parse = vi.spyOn(transformer, "parse").mockReturnValue("/@fs/foo.ts");
	const load = vi.spyOn(transformer, "load").mockResolvedValue(code);

	await tester.execute("MOCK_ROOT");

	expect(load).toHaveBeenCalledTimes(1);
	expect(parse).toHaveBeenCalledTimes(1);
	expect(load).toHaveBeenCalledWith("/@fs/foo.ts");
	expect(parse).toHaveBeenCalledWith("__tests__/fixtures/MOCK_ROOT", "/index.js");
});

it("should send the file if no transform needed", async () => {
	vi.spyOn(transformer, "parse").mockReturnValue("__tests__/fixtures/success-suite/index.js");
	vi.spyOn(transformer, "load").mockResolvedValue(undefined);

	return tester.successCase()();
});

it("should handle error thrown from transformer", () => {
	vi.spyOn(transformer, "parse").mockReturnValue("/@fs/foo.ts");
	vi.spyOn(transformer, "load").mockRejectedValue(new RangeError("Test Error"));

	return expect(tester.execute("MOCK_ROOT")).rejects.toThrow(/* Different in each browser */);
});
