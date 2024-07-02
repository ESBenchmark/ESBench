import { defineSuite } from "esbench";

const useIndex = (_, i) => i;

export default defineSuite({
	baseline: { type: "Name", value: "with" },
	params: {
		length: [10, 10000],
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

		scene.bench("with", () => {
			const array = new Array(length);
			for (let i = 0; i < length; i++) {
				array[i] = i;
			}
			return array;
		});

		scene.bench("without", () => {
			const array = [];
			for (let i = 0; i < length; i++) {
				array[i] = i;
			}
			return array;
		});

		scene.bench("map", () => {
			return Array.from({ length }, useIndex);
		});
	},
});
