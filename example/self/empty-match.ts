import { randomFillSync } from "crypto";
import { defineSuite } from "esbench";

const re = new RegExp("");

export default defineSuite({
	params: {
		size: [1, 10000],
	},
	setup(scene) {
		const buffer = Buffer.alloc(scene.params.size);
		const text = randomFillSync(buffer).toString("base64");

		scene.bench("RegExp", () => re.test(text));
		scene.bench("include", () => text.includes(""));
	},
});
