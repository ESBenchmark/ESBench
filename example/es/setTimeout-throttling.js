import { defineSuite } from "esbench";

const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));

export default defineSuite({
	params: {
		delay: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40],
	},
	timing: {
		warmup: 0,
		iterations: 1,
		evaluateOverhead: false,
	},
	setup(scene) {
		scene.benchAsync("sleep", () => sleep(scene.params.delay));
	},
});
