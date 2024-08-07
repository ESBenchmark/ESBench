import { AsyncFunction, asyncNoop, noop } from "@kaciras/utilities/browser";
import { defineSuite } from "esbench";

export function unroll(factor: number, isAsync: boolean) {
	const [call, FunctionType] = isAsync
		? ["await this()\n", AsyncFunction]
		: ["this()\n", Function];

	const body = `\
		const start = performance.now();
		while (count--) {
			${call.repeat(factor)}
		}
		return performance.now() - start;
	`;
	return new FunctionType("count", body);
}

function gcd(a: number, b: number): number {
	return a % b === 0 ? b : gcd(b, a % b);
}

function lcm(a: number, b: number) {
	return a * b / gcd(a, b);
}

// [1,2,4,8, ... 40]
const factories = Array.from({ length: 21 }, (_, i) => i * 2);
factories[0] = 1;

// Use the least common multiple as invocation count.
const iterations = factories.reduce(lcm, 1);
console.log(`Number of invocations: ${iterations}`);

export default defineSuite({
	params: {
		factor: factories,
	},
	baseline: {
		type: "factor",
		value: 16,
	},
	timing: {
		warmup: 1,
		iterations: 1,
	},
	setup(scene) {
		const { factor } = scene.params;
		const fn1 = unroll(factor, false).bind(noop);
		const fn2 = unroll(factor, true).bind(asyncNoop);
		const calls = iterations / factor;

		scene.bench("sync", () => fn1(calls));

		// Reduce the number of calls to run faster.
		scene.benchAsync("async", () => fn2(Math.round(calls / 1000)));
	},
});
