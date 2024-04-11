import { describe, expect, it } from "vitest";
import { firstItem } from "@kaciras/utilities/browser";
import data from "./fixtures/result-0.json" with { type: "json" };
import { Summary } from "../src/index.ts";

function expectHaveProperties(obj: any, props: any) {
	for (const [k, v] of Object.entries(props))
		expect(obj).toHaveProperty(k, v);
}

describe("constructor", () => {
	it("should associate notes with results", () => {
		const summary = new Summary(data.Suite as any);
		expect(summary.notes[0].row).toBe(summary.results[0]);
	});
});

describe("sort", () => {
	it("should throw error with invalid keys", () => {
		const summary = new Summary(data.Suite as any);
		expect(() => summary.sort(["FOO", "Name", "exists", "Builder", "Executor"]))
			.toThrow("FOO is not in variables");
	});

	it("should throw error keys is not all of variables", () => {
		const summary = new Summary(data.Suite as any);
		expect(() => summary.sort(["size", "exists"])).toThrow("Keys must be all variable names");
	});

	it("should sort results by variable keys", () => {
		const summary = new Summary(data.Suite as any);
		summary.sort(["size", "Name", "exists", "Builder", "Executor"]);

		expectHaveProperties(summary.results[0], {
			size: "0", Name: "object", exists: "true",
		});
		expectHaveProperties(summary.results[1], {
			size: "0", Name: "object", exists: "false",
		});
		expectHaveProperties(summary.results[2], {
			size: "0", Name: "map", exists: "true",
		});
		expectHaveProperties(summary.results[4], {
			size: "1000", Name: "object", exists: "true",
		});
		expectHaveProperties(summary.results[11], {
			size: "1000000", Name: "map", exists: "false",
		});
	});
});

describe("group", () => {
	it("should throw error with invalid key", () => {
		const summary = new Summary(data.Suite as any);
		expect(() => summary.group("FOO")).toThrow("FOO is not in variables");
	});

	it("should split results into groups", () => {
		const summary = new Summary(data.Suite as any);
		const groups = summary.group("size");

		const g1 = firstItem(groups.values());
		expect(groups.size).toBe(4);
		expect(g1).toHaveLength(3);
		for (const item of g1!) {
			expectHaveProperties(item, { Name: "object", exists: "true" });
		}
	});
});

describe("find", () => {
	it("should return undefined with invalid variable", () => {
		const summary = new Summary(data.Suite as any);
		const props = {
			Executor: "__INVALID__",
			Name: "map",
			size: "1000",
			Builder: "None",
			exists: "false",
		};
		expect(summary.find(props)).toBeUndefined();
	});

	it("should return undefined with different variables", () => {
		const summary = new Summary(data.Suite as any);
		const props = {
			Executor: "node",
			exists: "false",
		};
		expect(summary.find(props)).toBeUndefined();
	});

	it("should find result by variables", () => {
		const summary = new Summary(data.Suite as any);
		const found = summary.find({
			Executor: "node",
			Name: "map",
			size: "1000",
			Builder: "None",
			exists: "false",
		});
		const { throughput } = Summary.getMetrics(found!);
		expect((throughput as number[])[0]).toBe(252371971);
	});
});

describe("findAll", () => {
	it("should throw error if the variable does not exist", () => {
		const summary = new Summary(data.Suite as any);
		const constants = {
			Executor: "node",
			Name: "map",
			size: "1000",
			Builder: "None",
			exists: "false",
		};
		expect(() => summary.findAll(constants, "foo")).toThrow();
	});

	it("should find all results with only the variable different", () => {
		const summary = new Summary(data.Suite as any);
		const constants = {
			Executor: "node",
			Name: "map",
			size: "1000",
			Builder: "None",
			exists: "false",
		};
		const list = summary.findAll(constants, "exists");

		expect(list).toHaveLength(2);
		expectHaveProperties(list[0], {
			size: "1000", Name: "map", exists: "true",
		});
		expectHaveProperties(list[1], {
			size: "1000", Name: "map", exists: "false",
		});
	});

	it("should return array of undefined with invalid constants", () => {
		const summary = new Summary(data.Suite as any);
		const list = summary.findAll({}, "exists");
		expect(list).toStrictEqual([undefined, undefined]);
	});
});
