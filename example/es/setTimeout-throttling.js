import { defineSuite } from "esbench";

const sleep = delay => new Promise(resolve => setTimeout(resolve, delay));

export default defineSuite({
	params: {
		delay: Array.from({ length: 15 }).map((_, i) => i * 2),
	},
	timing: {
		warmup: 0,
	},
	setup(scene) {
		scene.benchAsync("sleep", () => sleep(scene.params.delay));
	},
});
