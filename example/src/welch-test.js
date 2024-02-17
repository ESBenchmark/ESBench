import { defineSuite } from "esbench";
import { welchTest } from "../../core/lib/math.js";

const a = [19.8, 20.4, 19.6, 17.8, 18.5, 18.9, 18.3, 18.9, 19.5, 22.0];
const b = [28.2, 26.6, 20.1, 23.3, 25.2, 22.1, 17.7, 27.6, 20.6, 13.7, 23.2, 17.5, 20.6, 18.0, 23.9, 21.6, 24.3, 20.4, 24.0, 13.2];

export default defineSuite({
	name: "Welch T-Test",
	setup(scene) {
		scene.bench("welch", () => welchTest(a, b, "not equal"));
	},
});
