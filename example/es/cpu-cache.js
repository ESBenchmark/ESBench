import { defineSuite } from "esbench";

const MB = 1024 * 1024;

// These are approximate sizes to fit in those caches. If you don't get the
// same results on your machine, it might be because your sizes differ.
const L1  = 0.25 * MB;
const L2  =    5 * MB;
const L3  =   18 * MB;
const RAM =   32 * MB;

// We'll be accessing the same buffer for all test cases, but we'll
// only be accessing the first 0 to `L1` entries in the first case,
// 0 to `L2` in the second, etc.
const buffer = new Int8Array(RAM);
buffer.fill(42);

const random = max => Math.floor(Math.random() * max);

export default defineSuite(scene => {
	scene.note("info", "Assume your CPU cache sizes are " +
		`L1: ${L1 / MB} MB, L2: ${L2 / MB} MB, L3: ${L3 / MB} MB.`);

	scene.bench("L1", () => {
		let _ = 0; for (let i = 0; i < 100000; i++) { _ += buffer[random(L1)]; }
	});
	scene.bench("L2", () => {
		let _ = 0; for (let i = 0; i < 100000; i++) { _ += buffer[random(L2)]; }
	});
	scene.bench("L3", () => {
		let _ = 0; for (let i = 0; i < 100000; i++) { _ += buffer[random(L3)]; }
	});
	scene.bench("RAM", () => {
		let _ = 0; for (let i = 0; i < 100000; i++) { _ += buffer[random(RAM)]; }
	});
});
