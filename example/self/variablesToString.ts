import { defineSuite } from "esbench";
import { variablesToString } from "../../core/src/utils.ts";
import data from "./380-no-metric.json" with { type: "json" };

const vars = data["es/map-object.js"][0].paramDef as any;

export default defineSuite(scene => {
	scene.bench("run", () => variablesToString(vars));
});
