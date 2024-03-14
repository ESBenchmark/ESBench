import { defineSuite } from "esbench";

export default defineSuite({
	name: "attribute selector vs class selector",
	async setup(scene) {
		for (let i = 0; i < 1000; i++) {
			const attr =  document.createElement("div");
			const clazz =  document.createElement("div");
			attr.setAttribute("data-v", "");
			clazz.className = "data-v";
			document.body.append(attr, clazz);
		}

		scene.bench("class", () => {
			return document.querySelectorAll(".data-v");
		});

		scene.bench("attr", () => {
			return document.querySelectorAll("*[data-v]");
		});
	},
});
