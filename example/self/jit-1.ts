import { defineSuite } from "esbench";

// https://www.reddit.com/r/node/comments/14gv7jb/benchmarking_javascript_is_hard
// https://github.com/tinylibs/tinybench/issues/46
export default defineSuite(scene => {
	for (const [k, v] of Object.entries({
		"a": (i: number) => i,
		"b": (i: number) => i,
		"c": (i: number) => i,
	})) {
		scene.bench(k, () => { for (let i = 0; i < 1000; i++) v(i); });
	}
});
