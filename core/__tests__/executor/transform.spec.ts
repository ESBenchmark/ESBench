import { pathToFileURL } from "node:url";
import { resolve, sep } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createPathMapper, transformer } from "../../src/executor/transform.ts";

const mockAdapter = {
	compileTS: vi.fn(() => "foobar"),
	resolve: vi.fn(),
};

const importerURL = pathToFileURL("module.js").href;
const importerPath = resolve("module.js").replaceAll("\\", "/");

const lines = (...args: string[]) => args.join("\n");

// Path is system-depend, so we use placeholder __ROOT__/ and replace it in tests.
const stacks = [{
	type: "webkit",
	raw: lines(
		"main@http://localhost:14715/index.js:5:29",
		"@",
		"@http://localhost:14715/loader.js:2:20",
		"module code@http://localhost:14715/loader.js:1:32",
	),
	expected: lines(
		"Error: the message",
		"    at main (__ROOT__/index.js:5:29)",
		"    at __ROOT__/loader.js:2:20",
		"    at module code (__ROOT__/loader.js:1:32)",
	),
}, {
	type: "chromium",
	raw: lines(
		"Error",
		"    at gen (http://localhost:14715/index.js:2:8)",
		"    at gen.next (<anonymous>)",
		"    at x (http://localhost:14715/index.js:6:13)",
		"    at http://localhost:14715/index.js:10:3",
	),
	expected: lines(
		"Error: the message",
		"    at gen (__ROOT__/index.js:2:8)",
		"    at gen.next (<anonymous>)",
		"    at x (__ROOT__/index.js:6:13)",
		"    at __ROOT__/index.js:10:3",
	),
}];

it.each(stacks)("should convert error stack of $type", input => {
	const rootResolved = resolve("www");
	input.expected = input.expected.replaceAll("__ROOT__/", rootResolved + sep);

	const error = {
		name: "Error",
		message: "the message",
		stack: input.raw,
		cause: {
			name: "Error",
			message: "the message",
			stack: input.raw,
		},
	};
	transformer.fixStack(error, "http://localhost:14715", "www");

	expect(error.stack).toStrictEqual(input.expected);
	expect(error.cause.stack).toStrictEqual(input.expected);
});

it("should resolve transformed import paths in error stack", () => {
	const instance = Object.create(transformer);
	instance.adapter = mockAdapter;

	const error = {
		message: "the message",
		name: "Error",
		stack: "main@http://[::1]/@fs/C:/temp/foobar.js:5:29",
	};

	instance.fixStack(error, "http://[::1]", "C:/www");
	expect(error.stack).toStrictEqual("Error: the message\n    at main (C:/temp/foobar.js:5:29)");
});

describe("transformer", () => {
	const instance = Object.create(transformer) as typeof transformer;
	instance.adapter = mockAdapter;

	it("should not parse imports if transform disabled", () => {
		expect(transformer.parse("root", "/index.js")).toBeUndefined();
		expect(transformer.parse("root", "/@fs/foo.js")).toBeUndefined();
	});

	it.each([
		["/index.js", "root/index.js"],
		["foo.js", undefined],
		["/@fs/foo.ts", "foo.ts"],
	])("should get the path if transform might be required", (path, expected) => {
		expected = expected?.replaceAll("/", sep);
		expect(instance.parse("root", path)).toBe(expected);
	});

	it("should throw error when parse a unresolvable path", () => {
		expect(() => instance.parse("root", "/@unresolvable?s=foo&p=bar")).toThrow();
	});

	it("should compile TS", async () => {
		const path = import.meta.filename;
		const code = await instance.load(path);

		expect(code).toBe("foobar");
		expect(mockAdapter.compileTS).toHaveBeenCalledWith(readFileSync(path, "utf8"), path);
	});

	it("should resolve imports", () => {
		const code = `\
			import x from "./x.js";
			const y = import(window.main);
			const z = import("y");
		`;
		instance.transformImports(code, "module.js");

		expect(mockAdapter.resolve).toHaveBeenNthCalledWith(1, "y", importerURL);
		expect(mockAdapter.resolve).toHaveBeenNthCalledWith(2, "./x.js", importerURL);
	});

	it.each([
		[undefined, "/@unresolvable?s=dummy.js&p=module.js"],
		[importerURL, "/@fs/" + importerPath],
		["https://example.com", "https://example.com"],
		["node:fs", "node:fs"],
	])("should replace import specifier %#", (resolved, specifier) => {
		mockAdapter.resolve.mockReturnValue(resolved);
		const code = `import x from "dummy.js"`;

		const output = instance.transformImports(code, "module.js");

		expect(output).toBe(`import x from "${specifier}"`);
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

it.each([
	[undefined, undefined],
	[{}, undefined],
	[{ zzz: "/11" }, undefined],
	[{ "/foo": "/11" }, "/11/bar.txt"],
	[
		{
			"/foo": "/11",
			"/foo/bar": "/22/qux",
		},
		"/22/qux.txt",
	],
])("should map the path %#", (map, expected) => {
	const resolve = createPathMapper(map);
	expect(resolve("/foo/bar.txt")).toBe(expected);
});
