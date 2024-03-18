import { defineSuite } from "esbench";

export default defineSuite({
	name: "Push values to array",
	setup(scene) {
		const length = 1000;
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
