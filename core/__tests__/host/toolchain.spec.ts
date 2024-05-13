import { join } from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { describe, expect, it, vi } from "vitest";
import inProcess from "../../src/executor/in-process.ts";
import { ViteBuilder } from "../../src/builder/rollup.ts";
import { noBuild } from "../../src/host/index.ts";
import JobGenerator from "../../src/host/toolchain.ts";
import { useTempDirectory } from "../helper.ts";

const tempDir = mkdtempSync(join(tmpdir(), "esbench-"));
useTempDirectory(tempDir);

describe("JobGenerator", () => {
	it("should throw error if a tool have more than 1 names", () => {
		const generator = new JobGenerator(tempDir, {});
		expect(() => generator.add({
			executors: [inProcess],
			include: ["test"],
			builders: [
				{ name: "foo", use: noBuild },
				{ name: "bar", use: noBuild },
			],
		})).toThrow("A tool can only have one name (foo vs bar)");
	});

	it("should throw error if a name used for more than 1 tools", () => {
		const generator = new JobGenerator(tempDir, {});
		expect(() => generator.add({
			executors: [inProcess],
			include: ["test"],
			builders: [
				{ name: "foo", use: new ViteBuilder() },
				{ name: "foo", use: noBuild },
			],
		})).toThrow("Each tool must have a unique name: foo");
	});

	it("should throw error if a tool has invalid name", () => {
		const generator = new JobGenerator(tempDir, {});
		expect(() => generator.add({
			executors: [inProcess],
			include: ["a"],
			builders: [{
				name: "",
				use: noBuild,
			}],
		})).toThrow("Tool name must be a non-blank string");
	});

	it("should allow a tool used in different toolchain", () => {
		const generator = new JobGenerator(tempDir, {});
		const builder = noBuild;

		generator.add({ executors: [inProcess], include: ["a"], builders: [builder] });
		generator.add({ executors: [inProcess], include: ["b"], builders: [builder] });
	});

	it("should skip build if no file matching", async () => {
		const build = vi.fn();
		const generator = new JobGenerator(tempDir, { file: "src" });

		generator.add({
			include: ["./__tests__/fixtures/**/*"],
			executors: [inProcess],
			builders: [{ name: "test", build }],
		});

		await generator.build();
		expect(build).not.toHaveBeenCalled();
	});

	it("should filter files to build", async () => {
		const build = vi.fn();
		const generator = new JobGenerator(tempDir, {
			file: "error-inside",
		});

		generator.add({
			include: ["./__tests__/fixtures/**/*"],
			executors: [inProcess],
			builders: [{ name: "test", build }],
		});
		await generator.build();

		const [root, files] = build.mock.calls[0];
		expect(build).toHaveBeenCalledOnce();
		expect(root).toMatch(join(tempDir, "build"));
		expect(files).toStrictEqual(["./__tests__/fixtures/error-inside/index.js"]);
	});

	it("should skip builder that has no file matched", async () => {
		const generator = new JobGenerator(tempDir, { file: "src" });

		generator.add({
			include: ["./__tests__/fixtures/**/*"],
			builders: [noBuild],
			executors: [inProcess],
		});

		await generator.build();
		expect(generator.getJobs().next().done).toBe(true);
	});

	it("should skip executor that has no file matched", async () => {
		const generator = new JobGenerator(tempDir, {});
		const executorStub = { name: "test", execute: vi.fn() };

		generator.add({
			include: ["./__tests__/fixtures/**/*"],
			builders: [noBuild],
			executors: [inProcess],
		});
		generator.add({
			include: ["./NOT_EXISTS/**"],
			builders: [noBuild],
			executors: [executorStub],
		});

		await generator.build();
		const jobs = Array.from(generator.getJobs());

		expect(jobs).toHaveLength(1);
		expect(jobs[0].executor).toBe(inProcess);
	});

	it("should generate jobs with files needed", async () => {
		const generator = new JobGenerator(tempDir, {});
		const executorStub = { name: "test", execute: vi.fn() };

		generator.add({
			include: ["./__tests__/fixtures/*-inside/*"],
			builders: [noBuild],
			executors: [inProcess],
		});
		generator.add({
			include: [
				"./__tests__/fixtures/success-*/*",
				"./__tests__/fixtures/*-outside/*",
			],
			builders: [noBuild],
			executors: [executorStub],
		});
		await generator.build();

		const jobs = Array.from(generator.getJobs());
		const { builds } = jobs[1];
		expect(jobs.length).toBe(2);
		expect(builds).toHaveLength(1);
		expect(builds[0].files).toStrictEqual([
			"./__tests__/fixtures/error-outside/index.js",
			"./__tests__/fixtures/success-suite/index.js",
		]);
	});

	it("should filter files by shared", async () => {
		const generator = new JobGenerator(tempDir, { shared: "1/2" });
		const builderA = { name: "A", build: vi.fn() };
		const builderB = { name: "B", build: vi.fn() };

		generator.add({
			include: ["./__tests__/fixtures/*-inside/*"],
			builders: [builderA],
			executors: [inProcess],
		});
		generator.add({
			include: ["./__tests__/fixtures/*-outside/*"],
			builders: [builderB],
			executors: [inProcess],
		});
		await generator.build();

		const jobs = Array.from(generator.getJobs());
		const { builds } = jobs[0];
		expect(jobs).toHaveLength(1);
		expect(builds[0].name).toBe("A");
		expect(builds[0].files).toHaveLength(1);
	});

	it("should dedupe builders with same executor", async () => {
		const generator = new JobGenerator(tempDir, {});
		generator.add({
			include: ["./__tests__/fixtures/*-inside/*"],
			builders: [noBuild],
			executors: [inProcess],
		});
		generator.add({
			include: ["./__tests__/fixtures/*-outside/*"],
			builders: [noBuild],
			executors: [inProcess],
		});

		await generator.build();
		const jobs = Array.from(generator.getJobs());
		expect(jobs).toHaveLength(1);
		expect(jobs[0].builds).toHaveLength(1);
	});
});
