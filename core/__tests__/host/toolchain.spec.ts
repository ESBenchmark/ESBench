import { join } from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { expect, it, vi } from "vitest";
import inProcess from "../../src/executor/in-process.ts";
import { ViteBuilder } from "../../src/builder/rollup.ts";
import { createLogger } from "../../src/host/logger.ts";
import { noBuild } from "../../src/host/index.ts";
import JobGenerator, { ToolChainItem } from "../../src/host/toolchain.ts";
import { useTempDirectory } from "../helper.ts";
import { FilterOptions } from "../../src/host/commands.ts";

const tempDir = mkdtempSync(join(tmpdir(), "esbench-"));
const logger = createLogger("off");

useTempDirectory(tempDir);

function testBuild(filter: FilterOptions, ...items: ToolChainItem[]) {
	const generator = new JobGenerator(tempDir, filter, logger);
	for (const item of items) {
		generator.add(item);
	}
	return generator.build().then(() => Array.from(generator.getJobs()));
}

it("should throw error if a tool have more than 1 names", () => {
	const generator = new JobGenerator(tempDir, {}, logger);
	const item = {
		executors: [inProcess],
		include: ["test"],
		builders: [
			{ name: "foo", use: noBuild },
			{ name: "bar", use: noBuild },
		],
	};
	expect(() => generator.add(item)).toThrow("A tool can only have one name (foo vs bar)");
});

it("should throw error if a name used for more than 1 tools", () => {
	const generator = new JobGenerator(tempDir, {}, logger);
	const item = {
		executors: [inProcess],
		include: ["test"],
		builders: [
			{ name: "foo", use: new ViteBuilder() },
			{ name: "foo", use: noBuild },
		],
	};
	expect(() => generator.add(item)).toThrow("Each tool must have a unique name: foo");
});

it("should throw error if a tool has invalid name", () => {
	const generator = new JobGenerator(tempDir, {}, logger);
	const item = {
		executors: [inProcess],
		include: ["a"],
		builders: [{ name: "", use: noBuild }],
	};
	expect(() => generator.add(item)).toThrow("Tool name must be a non-blank string");
});

it("should allow a tool used in different toolchain", () => {
	const generator = new JobGenerator(tempDir, {}, logger);
	const builder = noBuild;

	generator.add({ executors: [inProcess], include: ["a"], builders: [builder] });
	generator.add({ executors: [inProcess], include: ["b"], builders: [builder] });
});

it("should skip build if no file matching", async () => {
	const build = vi.fn();

	await testBuild({ file: "src" }, {
		include: ["./__tests__/fixtures/**/*"],
		executors: [inProcess],
		builders: [{ name: "test", build }],
	});

	expect(build).not.toHaveBeenCalled();
});

it("should filter files to build", async () => {
	const build = vi.fn();

	await testBuild({ file: "error-inside" }, {
		include: ["./__tests__/fixtures/**/*"],
		executors: [inProcess],
		builders: [{ name: "test", build }],
	});

	const [root, files] = build.mock.calls[0];
	expect(build).toHaveBeenCalledOnce();
	expect(root).toMatch(join(tempDir, "build"));
	expect(files).toStrictEqual(["./__tests__/fixtures/error-inside/index.js"]);
});

it("should skip builder that has no file matched", () => {
	const building = testBuild({ file: "src" }, {
		include: ["./__tests__/fixtures/**/*"],
		builders: [noBuild],
		executors: [inProcess],
	});
	return expect(building).resolves.toHaveLength(0);
});

it("should skip executor that has no file matched", async () => {
	const executorStub = { name: "test", execute: vi.fn() };

	const jobs = await testBuild({}, {
		include: ["./__tests__/fixtures/**/*"],
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

it("should filter files by shared", async () => {
	const builderA = { name: "A", build: vi.fn() };
	const builderB = { name: "B", build: vi.fn() };

	const jobs = await testBuild({ shared: "1/2" }, {
		include: ["./__tests__/fixtures/*-inside/*"],
		builders: [builderA],
		executors: [inProcess],
	}, {
		include: ["./__tests__/fixtures/*-outside/*"],
		builders: [builderB],
		executors: [inProcess],
	});

	expect(jobs).toHaveLength(1);
	expect(jobs[0].builds[0].name).toBe("A");
	expect(jobs[0].builds[0].files).toHaveLength(1);
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
