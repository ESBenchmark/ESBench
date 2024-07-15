import { readFileSync } from "node:fs";
import { defineSuite } from "esbench";

const filename = "package.json";
const moduleId = "../package.json";

export default defineSuite(scene => {
	scene.bench("read-utf8", () => JSON.parse(readFileSync(filename, "utf8")));
	scene.bench("read-bytes", () => JSON.parse(readFileSync(filename) as any));

	// TODO: clear module cache
	scene.benchAsync("import", () => import(moduleId, { with: { type: "json" } }));
});
