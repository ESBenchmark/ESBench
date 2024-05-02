import { defineSuite } from "esbench";

export default defineSuite({
	params: {
		length: [10, 10_000],
	},
	setup(scene) {
		const { length } = scene.params;
		const array = Array.from({ length }, (_, i) => i);
		const set = new Set(array);
		const value = array[Math.floor(array.length / 2)];

		scene.bench("set", () => set.has(value));
		scene.bench("array", () => array.includes(value));
	},
});
