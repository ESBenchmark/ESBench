import { pathToFileURL } from "url";
import { sep } from "path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { chromium } from "playwright-core";
import WebRemoteExecutor, { transformer } from "../../src/executor/web-remote.ts";
import { executorTester } from "../helper.ts";

const importerURL = pathToFileURL("module.js").toString();

describe("transformer", () => {
	const instance = Object.create(transformer);
	instance.enabled = true;

	it.each([
		["/index.js", "root/index.js"],
		["foo.js", undefined],
		["/@fs/foo.ts", "foo.ts"],
	])("should get the path if transform might be required", (path, expected) => {
		expected = expected?.replaceAll("/", sep);
		expect(instance.parse("root", path)).toBe(expected);
	});

	it("should replace imports", () => {
		const mock = vi.spyOn(instance, "resolve");
		mock.mockReturnValue("foobar.js");

		const code = `\
			import x from "./x.js";
			const y = import("y");
		`;
		const output = instance.transformImports(code, "module.js");

		expect(output).toBe(`\
			import x from "/@fs/foobar.js";
			const y = import("/@fs/foobar.js");
		`);
		expect(mock).toHaveBeenNthCalledWith(1, "y", importerURL);
		expect(mock).toHaveBeenNthCalledWith(2, "./x.js", importerURL);
	});

	it("should throw ENOENT when file not found", async () => {
		return expect(instance.load("./foo.js"))
			.rejects
			.toHaveProperty("code", "ENOENT");
	});

	it("should not load non-JS files", () => {
		return expect(instance.load("./foo.wasm")).resolves.toBeUndefined();
	});
});

describe("WebRemoteExecutor", async () => {
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

	it("should transfer messages", tester.successCase());

	it("should forward errors from runAndSend()", tester.insideError());

	it("should forward top level errors", tester.outsideError());
});
