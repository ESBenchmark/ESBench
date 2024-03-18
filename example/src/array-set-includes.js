import { defineSuite } from "esbench";

export default defineSuite({
	name: "Array.includes vs Set.has",
	params: {
		length: [0, 1, 100],
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
