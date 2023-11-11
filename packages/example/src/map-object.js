import { defineSuite } from "@esbench/core/client";

export default defineSuite({
	name: "Map vs Object",
	params: {
		existingSize: [0, 1000, 1000_000],
	},
	setup(scene) {
		const map = new Map();
		const obj = {};

		for (let i = 0; i < scene.params.existingSize; i++) {
			obj[Math.random().toString(36)] = 1;
			map.set(Math.random().toString(36), 1);
		}

		scene.bench("object", () => obj[Math.random().toString(36)]);
		scene.bench("map", () => map.get(Math.random().toString(36)));
	},
});
