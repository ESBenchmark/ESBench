import { defineSuite } from "esbench";

export default defineSuite({
	params: {
		length: [1, 1009],
	},
	setup(scene) {
		const { length } = scene.params;
		const data = Array.from({ length }, (_, i) => i);

		scene.bench("push", () => {
			const copy = [];
			for (const v of data) copy.push(v + 1);
			return copy;
		});

		scene.bench("map", () => {
			return Array.from(data, v => v + 1);
		});
	},
});
