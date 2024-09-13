import { readFileSync } from "node:fs";
import { afterAll, expect, it, vi } from "vitest";
import { chromium } from "playwright-core";
import WebRemoteExecutor from "../../src/executor/web-remote.ts";
import { executorTester } from "../helper.ts";
import { createPathMapper, transformer } from "../../src/executor/transform.ts";
import { HostContext } from "../../src/host/index.ts";
import { sleep } from "@kaciras/utilities/node";

vi.mock("../../src/executor/transform.ts");

const resolveAsset = vi.fn(() => undefined as any);
vi.mocked(createPathMapper).mockReturnValue(resolveAsset);

const tester = executorTester(new WebRemoteExecutor());

const browser = await chromium.launch();
const context = await browser.newContext();

afterAll(() => browser.close());

const baseExecute = tester.execute;
tester.execute = async (...args) => {
	const page = await context.newPage();
	try {
		await page.goto("http://localhost:14715");
		return await baseExecute(...args);
	} finally {
		await page.close();

		await sleep(100);
	}
};

it("should suggest a name", () => {
	expect(new WebRemoteExecutor().name).toBe("web remote");
});

it("should not return object method for content-type", async () => {
	// noinspection ES6MissingAwait
	baseExecute("fetch");

	const response = await fetch("http://localhost:14715/file.toString");
	expect(response.status).toBe(200);
	expect(response.headers.get("content-type")).toBe(null);
});

it("should create a path mapper", () => {
	const assets = { foo: "bar" };
	new WebRemoteExecutor({ assets });
	expect(createPathMapper).toHaveBeenCalledWith(assets);
});

it("should display listening port", async () => {
	const mockContext = new HostContext({});
	mockContext.info = vi.fn();

	const instance = new WebRemoteExecutor({ host: "::1", port: 39654 });
	await instance.start(mockContext);
	await instance.close();

	expect(mockContext.info).toHaveBeenCalledWith("[WebRemoteExecutor] Waiting for connection to: http://[::1]:39654");
});

it("should transfer messages", tester.successCase());

it("should forward errors from runAndSend()", tester.insideError());

it("should forward top level errors", tester.outsideError());

it("should throw error if the entry is invalid", () => {
	return expect(tester.execute("no-export")).rejects.toThrow();
});

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

it("should send the file if no transform needed", () => {
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
