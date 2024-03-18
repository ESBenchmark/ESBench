import { defineSuite } from "esbench";

export default defineSuite({
	name: "Array sort algorithms",
	baseline: {
		type: "Name",
		value: "builtin",
	},
	setup(scene) {
		const template = Array.from({ length: 1000 }, () => Math.random());
		let array = [];

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
