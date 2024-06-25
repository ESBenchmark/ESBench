import { defineSuite } from "esbench";
import { CXProduct } from "https://www.unpkg.com/cxproduct@2.1.4/index.js?module";
import bigCartesian from "https://www.unpkg.com/big-cartesian@6.0.0/build/src/main.js";
import { cartesianArray } from "https://www.unpkg.com/@kaciras/utilities@1.0.0/lib/browser.js";

function drain(generator) {
	for (const _ of generator) /* No-op */;
}

const arr4 = [1, 2, 3, 4];

export default defineSuite({
	params: {
		dimensions: [2, 10],
	},
	setup(scene) {
		const src = Array.from({ length: scene.params.dimensions }, () => arr4);

		scene.bench("cxproduct", () => drain(new CXProduct(src).asGenerator()));
		scene.bench("big-cartesian", () => drain(bigCartesian(src)));
		scene.bench("@kaciras/utilities", () => drain(cartesianArray(src)));
	},
});
