import { defineSuite } from "esbench";

const size = 100;

export default defineSuite(scene => {
	const style = document.createElement("style");
	style.innerText = "p { background: blue; height: 10px }";
	document.head.append(style);

	scene.teardown(() => style.remove());

	scene.bench("Visible", () => {
		document.body.style.removeProperty("display");
		document.body.replaceChildren();
		for (let i = 0; i < size; i++) {
			document.body.append(document.createElement("p"));
		}
	});

	scene.bench("hidden", () => {
		document.body.style.display = "none";
		document.body.replaceChildren();
		for (let i = 0; i < size; i++) {
			document.body.append(document.createElement("p"));
		}
	});
});
