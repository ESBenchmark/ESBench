import { defineSuite } from "esbench";

export default defineSuite({
	baseline: { type: "type", value: Set },
	params: {
		length: [10, 10_000],
		type: [Set, Array],
	},
	setup(scene) {
		const { length, type } = scene.params;
		const array = Array.from({ length }, (_, i) => i);

		const set = new Set(array);
		const value = array[Math.floor(array.length / 2)];

		if (type === Set) {
			scene.bench("create", () => new Set(array));
			scene.bench("has", () => set.has(value));
		} else {
			scene.bench("create", () => [...array]);
			scene.bench("has", () => array.includes(value));
		}
	},
});
