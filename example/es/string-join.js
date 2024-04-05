import { defineSuite } from "esbench";

export default defineSuite({
	name: "Combine strings",
	params: {
		separator: ["", ","],
	},
	validate: {
		equality: true,
	},
	baseline: {
		type: "Name",
		value: "Concat",
	},
	setup(scene) {
		const { separator } = scene.params;
		const length = 100;
		const values = Array.from({ length }, (_, i) => i.toString());

		scene.bench("Concat", separator ? () => {
			let result = "";
			for (const v of values)
				result += v + separator;
			return result.slice(0, -1);
		}: () => {
			let result = "";
			for (const v of values)
				result += v;
			return result;
		});

		scene.bench("Array join", () => {
			const parts = [];
			for (const v of values)
				parts.push(v);
			return parts.join(separator);
		});

		scene.bench("Array join with length", () => {
			const parts = new Array(length);
			for (let i = 0; i < length; i++) {
				parts[i] = values[i];
			}
			return parts.join(separator);
		});
	},
});
