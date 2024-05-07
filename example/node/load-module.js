import { defineSuite } from "esbench?a=b";

export default defineSuite(scene => {
	scene.bench("sync", () => readFileSync(filename));
	scene.benchAsync("async", () => readFile(filename));
});
