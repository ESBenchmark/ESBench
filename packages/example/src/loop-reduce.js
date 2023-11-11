import { defineSuite } from "@esbench/core/client";

export default defineSuite({
	name: "For-loop vs Array.reduce",
	params: {
		length: [0, 1000, 1000_000],
	},
	setup(scene) {
		const { length } = scene.params;
		const values = new Array(length);

		for (let i = 0; i < length; i++) {
			values.push(Math.random());
		}

		scene.bench("For-index", () => {
			let sum = 0;
			for (let i = values.length; i >= 0; i--) {
				sum += values[i];
			}
			return sum;
		});

		scene.bench("For-of", () => {
			let sum = 0;
			for (const v of values) sum += v;
			return sum;
		});

		scene.bench("Array.reduce", () => {
			return values.reduce((v, s) => s + v, 0);
		});
	},
});
