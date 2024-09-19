import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { chromium, firefox, webkit } from "playwright-core";
import { executorTester } from "../helper.ts";
import { PlaywrightExecutor, WebextExecutor } from "../../src/executor/playwright.ts";
import { createPathMapper, transformer } from "../../src/executor/transform.ts";

vi.mock("../../src/executor/transform.ts");

const resolveAsset = vi.fn(() => undefined as any);
vi.mocked(createPathMapper).mockReturnValue(resolveAsset);

it.each([
	[new PlaywrightExecutor(firefox), "firefox"],
	[new PlaywrightExecutor(webkit), "webkit"],
	[new PlaywrightExecutor(chromium), "chromium"],
	[new WebextExecutor(chromium), "chromium addon"],
])("should suggest a name %#", (executor, name) => {
	expect(executor.name).toBe(name);
});

it("should create a path mapper", () => {
	const assets = { foo: "bar" };
	new PlaywrightExecutor(firefox, { assets });
	expect(createPathMapper).toHaveBeenCalledWith(assets);
});

describe.each([firefox, webkit, chromium])("PlaywrightExecutor %#", type => {
	const tester = executorTester(new PlaywrightExecutor(type));

	// Browser launches slowly on CI.
	it("should transfer messages", { timeout: 10_000 }, tester.successCase());

	it("should forward errors from runAndSend()", tester.insideError());

	it("should forward top level errors", tester.outsideError());

	it("should respond 404 when resource not exists", async () => {
		const { result } = await tester.execute("fetch");
		expect(result).toHaveProperty("status", 404);
	});

	// https://caniuse.com/mdn-javascript_statements_import_import_attributes_type_json
	it.skipIf(type.name() === "firefox")("should support import attributes", tester.importJSON());

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

	it.each(["parse", "load"] as const)("should handle error thrown from transformer.%s", method => {
		vi.spyOn(transformer, "parse").mockReturnValue("/@fs/foo.ts");
		vi.spyOn(transformer, method).mockRejectedValue(new Error("Stub Error"));

		return expect(tester.execute("MOCK_ROOT")).rejects.toThrow(/* Different in each browser */);
	});

	it("should route requests with assets map", async () => {
		resolveAsset.mockReturnValueOnce(undefined); // index.js
		resolveAsset.mockReturnValue("__tests__/fixtures/fetch/file1.txt");

		const { result } = await tester.execute("fetch", "/foo/bar.txt");
		expect(result.status).toBe(200);
		expect(result.text).toBe("This is file 1\n");
		expect(resolveAsset).toHaveBeenCalledWith("/foo/bar.txt");
	});
});

describe("WebextExecutor", () => {
	const tester = executorTester(new WebextExecutor(chromium));

	it("should check browser type that can only be chromium", () => {
		expect(() => new WebextExecutor(firefox)).toThrow();
	});

	it("should run suites with extension API access", async () => {
		const { result } = await tester.execute("webext");
		expect(result.info).toHaveProperty("active", true);
	});
});
