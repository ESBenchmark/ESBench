import { defineSuite } from "esbench";

/**
 * What is the overhead of the generator?
 */
export default defineSuite(scene => {
	const length = 1000;
	const template = new Array(length);

	function* g() {
		for (const t of template) yield t;
	}

	scene.bench("Generator", () => {
		for (const _ of g()) {}
	});

	scene.bench("Loop", () => {
		for (const _ of template) {}
	});
});
