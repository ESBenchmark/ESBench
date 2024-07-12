import { defineSuite } from "esbench";

/**
 * Any performance difference between clear and create to reset a list?
 */
export default defineSuite({
	params: {
		type: [Set, Array],
		dataSize: [7, 1e4],
	},
	setup(scene) {
		const { type, dataSize } = scene.params;

		function fillArray(array) {
			for (let i = 0; i < dataSize; i++) array.push(i);
		}

		function fillSet(set) {
			for (let i = 0; i < dataSize; i++) set.add(i);
		}

		if (type === Set) {
			const collection = new Set();
			scene.bench("Reuse", () => {
				collection.clear();
				fillSet(collection);
			});
			scene.bench("Not Reuse", () => fillSet(new Set()));
		} else {
			const collection = [];
			scene.bench("Reuse", () => {
				collection.length = 0;
				fillArray(collection);
			});
			scene.bench("Not Reuse", () => fillArray([]));
		}
	},
});
