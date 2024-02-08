import { describe, expect, it, vi } from "vitest";
import { JobGenerator, report } from "../../src/host/host.js";
import result1And2 from "../fixtures/result-1+2.json" assert { type: " json" };
import { noBuild, ViteBuilder } from "../../src/host/index.js";
import direct from "../../src/executor/direct.js";

it("should merge results", async () => {
	const mockReporter = vi.fn();
	await report({
		reporters: [mockReporter],
	}, [
		"__tests__/fixtures/result-1.json",
		"__tests__/fixtures/result-2.json",
	]);
	expect(mockReporter).toHaveBeenCalledWith(result1And2, undefined);
});

describe("JobGenerator", () => {
	it("should throw error if a tool have more than 1 names", () => {
		const generator = new JobGenerator("", {});
		expect(() => generator.add({
			executors: [direct],
			include: ["test"],
			builders: [
				{ name: "foo", use: noBuild },
				{ name: "bar", use: noBuild },
			],
		})).toThrow("A tool can only have one name (foo vs bar)");
	});

	it("should throw error if a name used for more than 1 tools", () => {
		const generator = new JobGenerator("", {});
		expect(() => generator.add({
			executors: [direct],
			include: ["test"],
			builders: [
				{ name: "foo", use: new ViteBuilder() },
				{ name: "foo", use: noBuild },
			],
		})).toThrow("Each tool must have a unique name: foo");
	});

	it("should allow a tool used in different toolchain", () => {
		const generator = new JobGenerator("", {});
		const builder = noBuild;

		generator.add({
			executors: [direct],
			include: ["foo"],
			builders: [builder],
		});

		generator.add({
			executors: [direct],
			include: ["bar"],
			builders: [builder],
		});
	});
});
