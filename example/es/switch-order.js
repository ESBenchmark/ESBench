import { defineSuite } from "esbench";

const length = 100;
const base = 100;
const last = base + length * 2 - 1;

const numbers1 = Array.from({ length }, (_, i) => base + i);
const numbers2 = Array.from({ length }, (_, i) => length + base + i);

const switchNumber = new Function("value", `\
	switch (value) {
		${numbers1.map(n => "case " + n + ":\n").join("")}
		return true;
		${numbers2.map(n => "case " + n + ":\n").join("")}
		return false;
	}
`);

const switchString = new Function("value", `\
	switch (value) {
		${numbers1.map(n => "case '" + n + "':\n").join("")}
		return true;
		${numbers2.map(n => "case '" + n + "':\n").join("")}
		return false;
	}
`);

export default defineSuite({
	params: {
		type: ["number", "string"],
	},
	setup(scene) {
		if (scene.params.type === "number") {
			scene.bench("first", () => switchNumber(base));
			scene.bench("last", () => switchNumber(last));
		} else {
			scene.bench("first", () => switchString(base));
			scene.bench("last", () => switchString(last));
		}
	},
});
