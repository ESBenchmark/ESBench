import { readFileSync } from "fs";
import { defineSuite } from "esbench";

const filename = "package.json";
const moduleId = "../package.json";

export default defineSuite({
	name: "Read and parse JSON files",
	setup(scene) {
		scene.bench("read-utf8", () => JSON.parse(readFileSync(filename, "utf8")));
		scene.bench("read-bytes", () => JSON.parse(readFileSync(filename)));
		scene.benchAsync("import", () => import(moduleId, { with: { type: "json" } }));
	},
});
