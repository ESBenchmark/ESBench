import { it } from "vitest";
import { ResultCollector, SuiteRunner } from "../../src/client/index.js";

function fib(n: number) {
	let a = 0;
	let b = 1;

	while (a < n)
		[a, b] = [b, a + b];

	return b;
}

it("should works", async () => {
	const runner = new SuiteRunner({
		params: {
			n: [10, 100, 1000],
		},
		main(scene, params) {
			scene.add("Test", () => fib(params.n));
		},
	});

	const result = await runner.bench();

	const allResult = {};
	const collector = new ResultCollector(allResult);
	collector.collect("Foo", result);

	console.log(JSON.stringify(allResult, null, "\t"));
});
