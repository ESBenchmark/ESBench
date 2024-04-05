import { AsyncFunction, noop } from "@kaciras/utilities/browser";
import { defineSuite } from "esbench";

function unroll(factor, isAsync) {
	const call = isAsync ? "await f()" : "f()";
	const body = `\
		const start = performance.now();
		while (count--) {
			${new Array(factor).fill(call).join("\n")}
		}
		return performance.now() - start;
	`;
	return new AsyncFunction("f", "count", body);
}

function gcd(a, b) {
	return a % b === 0 ? b : gcd(b, a % b);
}

function lcm(a, b) {
	return a * b / gcd(a, b);
}

// [1,2,4,8, ... 40]
const factories = Array.from({ length: 21 }, (_, i) => i * 2);
factories[0] = 1;

// Use the least common multiple as invocation count.
const iterations = factories.reduce(lcm, 1);

export default defineSuite({
	name: "Loop unrolling",
	params: {
		factor: factories,
	},
	timing: {
		iterations: 1,
	},
	setup(scene) {
		const { factor } = scene.params;
		const fn = unroll(factor, false).bind(null, noop);
		scene.bench("noop", () => fn(iterations / factor));
	},
});
