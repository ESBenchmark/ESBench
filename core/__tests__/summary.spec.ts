import { expect, it } from "vitest";
import { firstItem } from "@kaciras/utilities/browser";
import data from "./fixtures/result-0.json" with { type: "json" };
import { Summary } from "../src/index.ts";

function expectHaveProperties(obj: any, props: any) {
	for (const [k, v] of Object.entries(props))
		expect(obj).toHaveProperty(k, v);
}

it("should associate notes with results", () => {
	const summary = new Summary(data.Suite as any);
	expect(summary.notes[0].row).toBe(summary.results[0]);
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

it("should findAll results with only the variable different", () => {
	const summary = new Summary(data.Suite as any);
	const list = summary.findAll({
		Executor: "node",
		Name: "map",
		size: "1000",
		Builder: "None",
		exists: "false",
	}, "exists");
	expect(list).toHaveLength(2);
	expectHaveProperties(list[0], {
		size: "1000", Name: "map", exists: "true",
	});
	expectHaveProperties(list[1], {
		size: "1000", Name: "map", exists: "false",
	});
});
