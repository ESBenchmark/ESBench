import { defineSuite } from "esbench";

export default defineSuite({
	params: {
		length: [10, 10_000],
	},
	setup(scene) {
		const { length } = scene.params;
		const data = Array.from({ length }, (_, i) => i);

		scene.bench("push each", () => {
			const copy = [];
			for (let i = 0; i < length; i++) {
				copy.push(data[i]);
			}
			return copy;
		});

		scene.bench("spread all", () => {
			const copy = [];
			copy.push(...data);
			return copy;
		});

		scene.bench("slice 1", () => {
			const copy = [];
			for (let i = 0; i < length; i += 1) {
				copy.push(...data.slice(i, i + 1));
			}
			return copy;
		});

		scene.bench("slice 10", () => {
			const copy = [];
			for (let i = 0; i < length; i += 10) {
				copy.push(...data.slice(i, i + 10));
			}
			return copy;
		});
	},
});
