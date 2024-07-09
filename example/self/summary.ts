import { firstItem } from "@kaciras/utilities/browser";
import { defineSuite, Summary, ToolchainResult } from "esbench";
import data from "./380-no-metric.json" with { type: "json" };

const results = data["es/map-object.js"] as unknown as ToolchainResult[];

export default defineSuite(scene => {
	const summary = new Summary(results);

	const reverse = [...summary.vars.keys()].reverse();
	const variables: Record<string, string> = {};
	for (const [k, vs] of summary.vars) {
		variables[k] = firstItem(vs)!;
	}

	scene.bench("constructor", () => new Summary(results));
	scene.bench("sort", () => summary.sort(reverse));
	scene.bench("split", () => summary.split("n"));
	scene.bench("find", () => summary.find(variables));
	scene.bench("findAll", () => summary.findAll(variables, "n"));
});
