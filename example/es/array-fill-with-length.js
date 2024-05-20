import { defineSuite } from "esbench";

const addOne = (_, i) => i + 1;

function fill(array, length) {
	for (let i = 0; i < length; i++) {
		array[i] = i + 1;
	}
	return array;
}

export default defineSuite({
	baseline: { type: "Name", value: "with" },
	params: {
		length: [1, 1000],
	},
	setup(scene) {
		const { length } = scene.params;

		scene.bench("push", () => {
			const array = [];
			for (let i = 0; i < length; i++) {
				array.push(i + 1);
			}
			return array;
		});
		scene.bench("map", () => {
			return Array.from({ length }, addOne);
		});
		scene.bench("without", () => {
			return fill([], length);
		});
		scene.bench("with", () => {
			return fill(new Array(length), length);
		});
	},
});
