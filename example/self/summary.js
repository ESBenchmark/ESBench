import { firstItem } from "@kaciras/utilities/browser";
import { defineSuite, Summary } from "esbench";
import data from "./380-no-metric.json" with { type: "json" };

const summary = new Summary(Object.values(data)[0]);

export default defineSuite({
	name: "Summary",
	setup(scene) {
		const reverse = [...summary.vars.keys()].reverse();
		const variables = {};
		for (const [k, vs] of summary.vars) {
			variables[k] = firstItem(vs);
		}
		scene.bench("sort", () => summary.sort(reverse));
		scene.bench("group", () => summary.group("n"));
		scene.bench("find", () => summary.find(variables));
		scene.bench("findAll", () => summary.findAll(variables, "n"));
	},
});
