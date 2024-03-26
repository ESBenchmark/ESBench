import { defineSuite } from "esbench";

export default defineSuite({
	name: "Map vs Object - Get",
	params: {
		size: [0, 1000, 1000_000],
		exists: [true, false],
	},
	timing: {
		throughput: "s",
	},
	setup(scene) {
		const { size, exists } = scene.params;

		const obj = Object.create(null);
		const map = new Map();
		for (let i = 0; i < size; i++) {
			const data = i.toString(36);
			obj[data] = data;
			map.set(data, data);
		}
		const key = exists ? `${size / 4}` : "123.0";

		scene.bench("object", () => obj[key]);
		scene.bench("map", () => map.get(key));
	},
});
