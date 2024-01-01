import { defineSuite } from "@esbench/core/client";

export default defineSuite({
	name: "Array sort algorithms",
	setup(scene) {
		const template = [];
		let array = [];
		for (let i = 0; i < 1000; i++) {
			template.push(Math.random());
		}

		scene.beforeIteration(() => array = template.slice());

		scene.bench("builtin", () => array.sort());

		scene.bench("bubble", () => {
			for (let i = 0; i < array.length; i++)
				for (let j = 0; j < array.length - i - 1; j++)
					if (array[j + 1] < array[j])
						[array[j + 1], array[j]] = [array[j], array[j + 1]];
		});
	},
});
