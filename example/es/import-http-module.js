import { defineSuite } from "esbench";
import { cartesianArray } from "https://www.unpkg.com/@kaciras/utilities@1.0.1/lib/browser.js";
import { CXProduct } from "https://www.unpkg.com/cxproduct@2.1.4/index.js?module";
import bigCartesian from "https://www.unpkg.com/big-cartesian@6.0.0/build/src/main.js";
import fastCartesian from "https://www.unpkg.com/fast-cartesian@7.0.0/build/src/main.js";
import fastCP from "https://www.unpkg.com/fast-cartesian-product@2.0.1/dist/index.mjs";
import PowerCP from "https://www.unpkg.com/power-cartesian-product@0.0.6/dist/index.mjs";

function drain(generator) {
	for (const _ of generator) /* No-op */;
}

const arr4 = [1, 2];

// Run this suite in Node need a flag: --experimental-network-imports
export default defineSuite({
	baseline: { type: "Name", value: "@kaciras/utilities" },
	params: {
		dimensions: [2, 20],
	},
	setup(scene) {
		const src = Array.from({ length: scene.params.dimensions }, () => arr4);

		scene.bench("@kaciras/utilities", () => drain(cartesianArray(src)));
		scene.bench("big-cartesian", () => drain(bigCartesian(src)));
		scene.bench("power-cartesian-product", () => drain(new PowerCP(src)));
		scene.bench("cxproduct", () => drain(new CXProduct(src).asGenerator()));

		// These return array faster than return generator, but cost more RAM.
		scene.bench("fast-cartesian", () => fastCartesian(src));
		scene.bench("fast-cartesian-product", () => fastCP(src));
	},
});
