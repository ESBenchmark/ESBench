import { defineSuite } from "esbench";

function fill(array, length) {
	for (let i = 0; i < length; i++) {
		array[i] = i;
	}
	return array;
}

export default defineSuite({
	name: "Array.includes vs Set.has",
	params: {
		length: [100],
	},
	baseline: {
		type: "Name",
		value: "with",
	},
	setup(scene) {
		const { length } = scene.params;
		scene.bench("push", () => {
			const array = [];
			for (let i = 0; i < length; i++) {
				array.push(i);
			}
			return array;
		});
		scene.bench("without", () => {
			return fill([], length);
		});
		scene.bench("with", () => {
			return fill(new Array(length), length);
		});
	},
});
