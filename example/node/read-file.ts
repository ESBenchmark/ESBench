import { readFileSync } from "fs";
import { readFile } from "fs/promises";
import { defineSuite } from "esbench";

const filename = "../pnpm-lock.yaml";

export default defineSuite(scene => {
	scene.bench("sync", () => readFileSync(filename));
	scene.benchAsync("async", () => readFile(filename));
});
