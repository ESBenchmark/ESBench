import { defineSuite } from "esbench";

const KB = 1024;
const MB = 1024 * KB;

// These are approximate sizes to fit in those caches. If you don't get the
// same results on your machine, it might be because your sizes differ.
const L1  = 256 * KB;
const L2  =   5 * MB;
const L3  =  18 * MB;
const RAM =  32 * MB;

// We'll be accessing the same buffer for all test cases, but we'll
// only be accessing the first 0 to `L1` entries in the first case,
// 0 to `L2` in the second, etc.
const buffer = new Int8Array(RAM);
buffer.fill(42);

const random = max => Math.floor(Math.random() * max);

export default defineSuite(scene => {
	scene.bench("L1", () => {
		let r = 0; for (let i = 0; i < 100000; i++) { r += buffer[random(L1)]; }
	});
	scene.bench("L2", () => {
		let r = 0; for (let i = 0; i < 100000; i++) { r += buffer[random(L2)]; }
	});
	scene.bench("L3", () => {
		let r = 0; for (let i = 0; i < 100000; i++) { r += buffer[random(L3)]; }
	});
	scene.bench("RAM", () => {
		let r = 0; for (let i = 0; i < 100000; i++) { r += buffer[random(RAM)]; }
	});
});
