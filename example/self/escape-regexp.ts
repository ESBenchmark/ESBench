import { defineSuite } from "esbench";

const text = "D:\\files\\movies\\[210902] How much $ for a 🦄? (English).mkv";

const reSymbols = "\\.?*+^$[](){}|";

export default defineSuite({
	validate: {
		equality: true,
	},
	setup(scene) {
		scene.bench("use loop", () => {
			const characters = [];
			for (const c of text) {
				if (reSymbols.includes(c)) {
					characters.push("\\");
				}
				characters.push(c);
			}
			return characters.join("");
		});

		scene.bench("use regex", () => {
			return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		});
	},
});
