import { defineSuite } from "esbench";

function fib(n) {
	let [a, b] = [0, 1];
	for (let i = 0; i < n; i++) {
		[a, b] = [b, a + b];
	}
	return b;
}

const dynamic = new Function("n", `\
	let [c, d] = [0, 1];
	for (let i = 0; i < n; i++) {
		[c, d] = [d, c + d];
	}
	return d;
`);

/**
 * Verify that there is no performance difference between
 * dynamically created function and the static one.
 */
export default defineSuite(scene => {
	const n = 10_000;
	scene.bench("static", () => fib(n));
	scene.bench("dynamic", () => dynamic(n));
});
