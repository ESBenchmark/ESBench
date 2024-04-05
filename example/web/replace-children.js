import { defineSuite } from "esbench";

export default defineSuite({
	name: "replaceChildren vs append",
	async setup(scene) {
		const length = 1000;

		scene.bench("replaceChildren", () => {
			const elements = Array.from({ length }, () => document.createElement("p"));

			document.body.replaceChildren(...elements);
		});

		scene.bench("spared append", () => {
			const elements = Array.from({ length }, () => document.createElement("p"));

			document.body.innerHTML = "";
			document.body.append(...elements);
		});

		scene.bench("loop append", () => {
			const elements = Array.from({ length }, () => document.createElement("p"));

			document.body.innerHTML = "";
			for (const el of elements) document.body.append(el);
		});
	},
});
