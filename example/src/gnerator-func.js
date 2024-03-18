import { defineSuite } from "esbench";

export default defineSuite({
	name: "Generator function",
	setup(scene) {
		const length = 1000;
		const template = Array.from({ length }, (_, i) => i);

		function* g() {
			for (const t of template) yield t + 1;
		}

		const add1 = v => v + 1;

		scene.bench("from", () => {
			return Array.from(template, add1);
		});

		scene.bench("Loop", () => {
			let array = [];
			for (const t of template) {
				array.push(t + 1);
			}
			return array;
		});

		scene.bench("Generator", () => {
			return Array.from(g());
		});
	},
});
