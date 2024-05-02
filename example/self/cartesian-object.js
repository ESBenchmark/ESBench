import { defineSuite } from "esbench";

const objectDef = {
	foo: [11, 22, 33, 44, 55],
	bar: ["abcdefg", "hijklmn"],
	baz: [true, false],
	qux: [1024, 2048, 4096, 8192],
};

const o = JSON.stringify(objectDef);
const e = JSON.stringify(Object.entries(objectDef));

export default defineSuite(scene => {
	scene.bench("entries", () => JSON.parse(e));
	scene.bench("object", () => Object.entries(JSON.parse(o)));
});
