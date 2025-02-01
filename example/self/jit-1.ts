import { defineSuite } from "esbench";

function loop1k(fn: any) {
	for (let i = 0; i < 1000; i++) fn(i);
}

/*
 * All cases should have about the same elapsed time.
 *
 * https://www.reddit.com/r/node/comments/14gv7jb/benchmarking_javascript_is_hard
 * https://github.com/tinylibs/tinybench/issues/46
 */
export default defineSuite({
	params: {
		iterHook: [false, true],
	},
	timing: {
		iterations: 1e5,
	},
	setup(scene) {
		if (scene.params.iterHook) {
			scene.beforeIteration(() => {});
		}

		function defineBench(name: string, fn: any) {
			scene.bench(name, () => loop1k(fn));
		}

		defineBench("a", (i: number) => i);
		defineBench("b", (i: number) => i);
		defineBench("c", (i: number) => i);
	},
});
