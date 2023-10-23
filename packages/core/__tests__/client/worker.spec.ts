import { expect, it, vi } from "vitest";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { BenchmarkSuite, defineSuite, ResultCollector, SuiteRunner } from "../../src/client/index.js";

function fib(n: number) {
	let a = 0;
	let b = 1;

	while (a < n)
		[a, b] = [b, a + b];

	return b;
}

function run<T extends CPSrcObject>(suite: BenchmarkSuite<T>) {
	return new SuiteRunner(suite, noop).run();
}

it("should works", async () => {
	const result = await run({
		params: {
			n: [10, 100, 1000],
		},
		main(scene, params) {
			scene.add("Test", () => fib(params.n));
		},
	});

	const allResult = {};
	const collector = new ResultCollector(allResult);
	collector.collect("Foo", result);
	console.log(JSON.stringify(allResult, null, "\t"));
});

it("should validate executions", async () => {
	const fn = vi.fn();
	const suite = defineSuite({
		options: {
			validateExecution: true,
		},
		params: {
			n: [10, 100, 1000],
		},
		main(scene, params) {
			scene.add("Success", fn);

			if (params.n === 100) {
				scene.add("Test", () => {throw new Error("x");});
			}
		},
	});

	await expect(run(suite)).rejects.toThrow();
	expect(fn).toHaveBeenCalledTimes(2);
});

it("should validate return values", () => {
	const suite = defineSuite({
		options: {
			validateReturnValue: true,
		},
		main(scene) {
			scene.add("A", () => 11);
			scene.add("B", () => 22);
		},
	});

	return expect(run(suite)).rejects.toThrow();
});

it("should support custom validator", () => {
	const suite = defineSuite({
		options: {
			validateReturnValue: a => a === 11,
		},
		main(scene) {
			scene.add("A", () => 11);
			scene.add("B", () => 22);
		},
	});

	return expect(run(suite)).resolves.toBeTruthy();
});
