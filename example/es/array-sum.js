import { defineSuite } from "esbench";

/**
 * Do for-of and Array.reduce() have performance overheads?
 */
export default defineSuite({
	baseline: { type: "Name", value: "For-index" },
	params: {
		length: [0, 100, 10_000],
	},
	setup(scene) {
		const { length } = scene.params;
		const values = Array.from({ length }, (_, i) => i);

		scene.bench("For-index", () => {
			let sum = 0;
			for (let i = 0; i < length; i++) sum += values[i];
			return sum;
		});

		scene.bench("For-of", () => {
			let sum = 0;
			for (const v of values) sum += v;
			return sum;
		});

		scene.bench("Array.reduce", () => {
			// Empty array require a init value for reducing.
			return values.reduce((v, s) => s + v, 0);
		});
	},
});
