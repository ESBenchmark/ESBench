import { expect, it, vi } from "vitest";
import { defineSuite, ResultCollector, SuiteRunner } from "../../src/client/index.js";

function fib(n: number) {
	let a = 0;
	let b = 1;

	while (a < n)
		[a, b] = [b, a + b];

	return b;
}

it("should works", async () => {
	const runner = new SuiteRunner(defineSuite({
		params: {
			n: [10, 100, 1000],
		},
		main(scene, params) {
			scene.add("Test", () => fib(params.n));
		},
	}));

	const result = await runner.run();

	const allResult = {};
	const collector = new ResultCollector(allResult);
	collector.collect("Foo", result);

	console.log(JSON.stringify(allResult, null, "\t"));
});

it("should validate executions", async () => {
	const fn = vi.fn();
	const runner = new SuiteRunner(defineSuite({
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
	}));

	await expect(runner.run()).rejects.toThrow();
	expect(fn).toHaveBeenCalledTimes(2);
});

it("should validate return values", () => {
	const runner = new SuiteRunner(defineSuite({
		options: {
			validateReturnValue: true,
		},
		main(scene) {
			scene.add("A", () => 11);
			scene.add("B", () => 22);
		},
	}));

	return expect(runner.run()).rejects.toThrow();
});

it("should support custom validator", () => {
	const runner = new SuiteRunner(defineSuite({
		options: {
			validateReturnValue: a => a === 11,
		},
		main(scene) {
			scene.add("A", () => 11);
			scene.add("B", () => 22);
		},
	}));

	return expect(runner.run()).resolves.toBeTruthy();
});
