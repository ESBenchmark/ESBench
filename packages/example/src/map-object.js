import { defineSuite } from "@esbench/core/client";

export default defineSuite({
	name: "Map vs Object",
	params: {
		existingSize: [0, 1000, 1000_000],
	},
	setup(scene, params) {
		const map = new Map();
		const obj = {};

		for (let i = 0; i < params.existingSize; i++) {
			obj[Math.random().toString(36)] = 1;
			map.set(Math.random().toString(36), 1);
		}

		scene.add("object", () => obj[Math.random().toString(36)]);
		scene.add("map", () => map.get(Math.random().toString(36)));
	},
});
