import { defineSuite } from "esbench";

const textToMatch = "D:\\files\\movies\\[210902] How much $ for a 🦄? (English).mkv";

const reSymbols = "\\.?*+^$[](){}|";

export default defineSuite({
	validate: {
		equality: true,
	},
	setup(scene) {
		scene.bench("use loop", () => {
			const characters = [];
			for (const c of textToMatch) {
				if (reSymbols.includes(c)) {
					characters.push("\\");
				}
				characters.push(c);
			}
			return characters.join("");
		});

		scene.bench("use regex", () => {
			return textToMatch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		});
	},
});
