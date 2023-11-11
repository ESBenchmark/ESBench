import { expect, it, vi } from "vitest";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { BenchmarkSuite, runSuite } from "../../src/client/index.js";

function fib(n: number) {
	let a = 0;
	let b = 1;

	while (a < n)
		[a, b] = [b, a + b];

	return b;
}

export function run<T extends CPSrcObject>(suite: Partial<BenchmarkSuite<T>>, pattern?: RegExp) {
	suite.name ??= "Test Suite";
	suite.config = {
		iterations: 1,
		samples: 1,
		warmup: 0,
		...suite.config,
	};
	return runSuite(suite as any, { logger: noop, pattern });
}

it("should works", async () => {
	const result = await run({
		params: {
			n: [10, 100, 1000],
		},
		setup(scene) {
			scene.bench("Test", () => fib(scene.params.n));
		},
	});

	expect(result.name).toBe("Test Suite");
	expect(result.scenes).toHaveLength(3);
	expect(result.scenes[0]).toHaveLength(1);
});

it("should validate sample count", () => {
	const promise = run({
		config: { samples: 0 },
		setup: (scene) => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should validate iteration count", () => {
	const promise = run({
		config: { iterations: 0 },
		setup: (scene) => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should validate iteration time", () => {
	const promise = run({
		config: { iterations: "0m" },
		setup: (scene) => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should call lifecycle hooks", async () => {
	const invocations: any[] = [];

	const beforeEach = () => invocations.push(beforeEach);
	const beforeIter = () => invocations.push(beforeIter);
	const workload = () => invocations.push(workload);
	const afterIter = () => invocations.push(afterIter);
	const afterEach = () => invocations.push(afterEach);
	const afterAll = () => invocations.push(afterAll);

	await run({
		config: { iterations: 1, samples: 1 },
		params: { n: [10, 100] },
		afterAll,
		setup(scene) {
			beforeEach();
			scene.afterEach(afterEach);
			scene.beforeIteration(beforeIter);
			scene.afterIteration(afterIter);
			scene.bench("Foo", workload);
		},
	});

	expect(invocations).toStrictEqual([
		beforeEach, beforeIter, workload, afterIter, afterEach,
		beforeEach, beforeIter, workload, afterIter, afterEach, afterAll,
	]);
});

it("should filter workloads with pattern", async () => {
	const foo = vi.fn();
	const bar = vi.fn();

	await run({
		params: { n: [10, 100] },
		setup(scene) {
			scene.bench("test foo", foo);
			scene.bench("bar test", bar);
		},
	}, /^test/);

	expect(foo).toHaveBeenCalled();
	expect(bar).not.toHaveBeenCalled();
});
