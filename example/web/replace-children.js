import { defineSuite } from "esbench";

export default defineSuite(async scene => {
	const length = 1000;
	const elements = Array.from({ length }, () => document.createElement("p"));

	scene.bench("replaceChildren", () => {
		document.body.replaceChildren(...elements);
	});

	scene.bench("spared append", () => {
		document.body.innerHTML = "";
		document.body.append(...elements);
	});

	scene.bench("loop append", () => {
		document.body.innerHTML = "";
		for (const el of elements) document.body.append(el);
	});
});
