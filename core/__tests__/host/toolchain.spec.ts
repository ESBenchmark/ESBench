import { join, resolve } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { noop } from "@kaciras/utilities/browser";
import { expect, it, vi } from "vitest";
import inProcess from "../../src/executor/in-process.ts";
import { FilterOptions, HostContext } from "../../src/host/context.ts";
import { noBuild } from "../../src/host/index.ts";
import JobGenerator, { ToolChainItem } from "../../src/host/toolchain.ts";
import { useTempDirectory } from "../helper.ts";

const tempDir = mkdtempSync(join(tmpdir(), "esbench-"));

useTempDirectory(tempDir);

// JS does not support strip indent for multiline string :(
function assertRejectMessage(promise: Promise<any>, lines: string[]) {
	return expect(promise).rejects.toThrow(lines.join("\n"));
}

function create(filter?: FilterOptions) {
	return new JobGenerator(new HostContext({ logLevel: "off", tempDir }, filter));
}

function testBuild(filter: FilterOptions, ...toolchains: ToolChainItem[]) {
	const config = { logLevel: "off", tempDir, toolchains } as const;
	return JobGenerator.generate(new HostContext(config, filter));
}

it("should throw error if a tool have more than 1 names", () => {
	const promise = testBuild({}, {
		executors: [inProcess],
		include: ["./__tests__/fixtures/*"],
		builders: [
			{ name: "foo", use: noBuild },
			{ name: "bar", use: noBuild },
		],
	});
	return assertRejectMessage(promise, [
		"A tool can only have one name (foo vs bar)",
		"├─ toolchains[0].builders[0]",
		"└─ toolchains[0].builders[1]",
	]);
});

it("should throw error if a name used for more than 1 tools", () => {
	const promise = testBuild({}, {
		executors: [inProcess],
		include: ["./__tests__/fixtures/*"],
		builders: [
			{ name: "foo", build: noop },
			{ name: "foo", use: noBuild },
		],
	});
	return assertRejectMessage(promise, [
		"Each tool must have a unique name: foo",
		"├─ toolchains[0].builders[0]",
		"└─ toolchains[0].builders[1]",
	]);
});

it("should throw error if a tool has invalid name", () => {
	const promise = testBuild({}, {
		executors: [inProcess],
		include: ["./__tests__/fixtures/*"],
		builders: [{ name: "", use: noBuild }],
	});
	return assertRejectMessage(promise, [
		"Tool name must be a non-blank string",
		"└─ toolchains[0].builders[0]",
	]);
});

it("should allow a tool used in different toolchain", () => {
	const generator = create();
	generator.add({ executors: [inProcess], include: ["a"], builders: [noBuild] });
	generator.add({ executors: [inProcess], include: ["b"], builders: [noBuild] });
});

it("should skip build if no file matching", async () => {
	const build = vi.fn();

	const jobs = await testBuild({ file: "NOT_EXISTS" }, {
		include: ["./__tests__/fixtures/*"],
		executors: [inProcess],
		builders: [{ name: "test", build }],
	});

	expect(jobs).toHaveLength(0);
	expect(build).not.toHaveBeenCalled();
});

it("should filter files to build", async () => {
	const build = vi.fn();

	await testBuild({ file: "error-inside" }, {
		include: ["./__tests__/fixtures/*/*"],
		executors: [inProcess],
		builders: [{ name: "test", build }],
	});

	const [root, files] = build.mock.calls[0];
	expect(build).toHaveBeenCalledOnce();
	expect(root).toMatch(join(tempDir, "build"));
	expect(files).toStrictEqual(["./__tests__/fixtures/error-inside/index.js"]);
});

it("should filter toolchain item by file", () => {
	const generator = create({ file: "NOT_EXISTS" });
	generator.add({
		executors: [inProcess],
		include: ["./__tests__/fixtures/*"],
		builders: [
			{ name: "foo", use: noBuild },
			{ name: "bar", use: noBuild },
		],
	});
	generator.add({
		builders: [noBuild],
		include: ["zzz"],
		executors: [inProcess, inProcess],
	});
});

it("should ignore builder that name does not match the regexp", async () => {
	const builderStub = { name: "foobar", build: noop };
	const jobs = await testBuild({ builder: "foobar" }, {
		include: ["./__tests__/fixtures/error-*/*"],
		builders: [noBuild],
		executors: [inProcess],
	}, {
		include: ["./__tests__/fixtures/success-*/*"],
		builders: [noBuild, builderStub],
		executors: [inProcess],
	});
	expect(jobs[0].builds).toHaveLength(1);
	expect(jobs[0].builds[0].files).toStrictEqual(["./__tests__/fixtures/success-suite/index.js"]);
});

it("should skip executor that has no file matched", async () => {
	const executorStub = { name: "test", execute: vi.fn() };

	const jobs = await testBuild({}, {
		include: ["./__tests__/fixtures/*/*"],
		builders: [noBuild],
		executors: [inProcess],
	}, {
		include: ["./NOT_EXISTS/**"],
		builders: [noBuild],
		executors: [executorStub],
	});

	expect(jobs).toHaveLength(1);
	expect(jobs[0].executor).toBe(inProcess);
});

it("should generate jobs with files needed", async () => {
	const executorStub = { name: "test", execute: vi.fn() };

	const jobs = await testBuild({}, {
		include: ["./__tests__/fixtures/*-inside/*"],
		builders: [noBuild],
		executors: [inProcess],
	}, {
		include: [
			"./__tests__/fixtures/success-*/*",
			"./__tests__/fixtures/*-outside/*",
		],
		builders: [noBuild],
		executors: [executorStub],
	});

	const { builds } = jobs[1];
	expect(jobs.length).toBe(2);
	expect(builds).toHaveLength(1);
	expect(builds[0].files).toStrictEqual([
		"./__tests__/fixtures/error-outside/index.js",
		"./__tests__/fixtures/success-suite/index.js",
	]);
});

it("should dedupe files", async () => {
	const mockBuilder = { name: "mock", build: vi.fn() };

	const jobs = await testBuild({}, {
		include: ["./__tests__/fixtures/*-inside/*"],
		builders: [mockBuilder],
		executors: [inProcess],
	}, {
		include: ["./__tests__/fixtures/error-*/*"],
		builders: [mockBuilder],
		executors: [inProcess],
	});

	expect(mockBuilder.build).toHaveBeenCalledOnce();
	expect(mockBuilder.build.mock.calls[0][1]).toStrictEqual([
		"./__tests__/fixtures/error-inside/index.js",
		"./__tests__/fixtures/error-outside/index.js",
	]);
	expect(jobs[0].builds[0].files).toStrictEqual([
		"./__tests__/fixtures/error-inside/index.js",
		"./__tests__/fixtures/error-outside/index.js",
	]);
});

it("should only execute files in the build", async () => {
	const mockBuilder = { name: "mock", build: vi.fn() };

	const jobs = await testBuild({}, {
		include: ["./__tests__/fixtures/*-inside/*"],
		builders: [noBuild],
		executors: [inProcess],
	}, {
		include: ["./__tests__/fixtures/error-*/*"],
		builders: [mockBuilder],
		executors: [inProcess],
	});

	expect(jobs[0].builds[0].files).toStrictEqual([
		"./__tests__/fixtures/error-inside/index.js",
	]);
});

it("should filter files by shared 1/2", async () => {
	const builderA = { name: "A", build: vi.fn() };
	const builderB = { name: "B", build: vi.fn() };

	const [{ builds }] = await testBuild({ shared: "1/2" }, {
		include: ["./__tests__/fixtures/error-*/*"],
		builders: [builderA],
		executors: [inProcess],
	}, {
		include: ["./__tests__/fixtures/success-*/*"],
		builders: [builderB],
		executors: [inProcess],
	});

	expect(builds).toHaveLength(1);
	expect(builds[0].files).toStrictEqual([
		"./__tests__/fixtures/error-outside/index.js",
	]);
});

it("should filter files by shared 2/2", async () => {
	const builderA = { name: "A", build: vi.fn() };
	const builderB = { name: "B", build: vi.fn() };

	const [{ builds }] = await testBuild({ shared: "2/2" }, {
		include: ["./__tests__/fixtures/error-*/*"],
		builders: [builderA],
		executors: [inProcess],
	}, {
		include: ["./__tests__/fixtures/success-*/*"],
		builders: [builderB],
		executors: [inProcess],
	});

	expect(builds).toHaveLength(2);
	expect(builds[0].files).toStrictEqual([
		"./__tests__/fixtures/error-inside/index.js",
	]);
	expect(builds[1].files).toStrictEqual([
		"./__tests__/fixtures/success-suite/index.js",
	]);
});

it("should filter toolchain item by shared", async () => {
	const builderA = { name: "A", build: vi.fn() };

	await testBuild({ shared: "1/2" }, {
		include: ["./__tests__/fixtures/fetch/*.js"],
		builders: [builderA],
		executors: [inProcess],
	}, {
		include: ["./__tests__/fixtures/inspect/*.js"],
		// Filtered out, so dedupe tool does not fail the build.
		builders: [noBuild, noBuild],
		executors: [inProcess, inProcess],
	});
});

it("should dedupe builders with same executor", async () => {
	const jobs = await testBuild({}, {
		include: ["./__tests__/fixtures/*-inside/*"],
		builders: [noBuild],
		executors: [inProcess],
	}, {
		include: ["./__tests__/fixtures/*-outside/*"],
		builders: [noBuild],
		executors: [inProcess],
	});
	expect(jobs).toHaveLength(1);
	expect(jobs[0].builds).toHaveLength(1);
});

it("should ignore files with the exclude option", async () => {
	const jobs = await testBuild({}, {
		include: ["__tests__/fixtures/error-*/*"],
		exclude: ["**/*-outside/*"],
		builders: [noBuild],
		executors: [inProcess],
	});
	expect(jobs[0].builds[0].files).toHaveLength(1);
});

it("should exclude files only in item scope", async () => {
	const pattern = ["__tests__/fixtures/error-inside/*"];
	const executorStub = { name: "test", execute: vi.fn() };

	const jobs = await testBuild({}, {
		include: pattern,
		builders: [noBuild],
		executors: [inProcess],
	}, {
		include: ["__tests__/fixtures/error-*/*"],
		exclude: pattern,
		builders: [noBuild],
		executors: [executorStub],
	});
	expect(jobs).toHaveLength(2);
	expect(jobs[0].builds[0].files).toStrictEqual(["./__tests__/fixtures/error-inside/index.js"]);
	expect(jobs[1].builds[0].files).toStrictEqual(["./__tests__/fixtures/error-outside/index.js"]);
});

it("should support absolute path patterns", async () => {
	const pattern = resolve("__tests__/fixtures/*-inside/*");
	const jobs = await testBuild({}, {
		include: [pattern],
		builders: [noBuild],
		executors: [inProcess],
	});
	expect(jobs[0].builds[0].files).toStrictEqual(["./__tests__/fixtures/error-inside/index.js"]);
});

it("should convert paths to import specifiers", async () => {
	const jobs = await testBuild({}, {
		include: ["__tests__/fixtures/*-inside/*"],
		builders: [noBuild],
		executors: [inProcess],
	});
	expect(jobs[0].builds[0].files).toStrictEqual(["./__tests__/fixtures/error-inside/index.js"]);
});
