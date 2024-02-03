import { expect, it, vi } from "vitest";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { sleep1 } from "../helper.js";
import { BenchmarkSuite, runSuite } from "../../src/client/index.js";

export function run<T extends CPSrcObject>(suite: Partial<BenchmarkSuite<T>>, pattern?: RegExp) {
	suite.name ??= "Test Suite";
	suite.timing = {
		iterations: 1,
		samples: 1,
		warmup: 0,
		evaluateOverhead: false,
		unrollFactor: 1,
		...(suite.timing as any),
	};
	return runSuite(suite as any, { log: noop, pattern });
}

it("should return the result", async () => {
	const result = await run({
		params: {
			n: [10, 100, 1000],
		},
		setup(scene) {
			scene.benchAsync("Test", sleep1);
		},
	});
	expect(result.paramDef).toStrictEqual([
		["n", ["10", "100", "1000"]],
	]);
	expect(result.meta.time).toBeTypeOf("object");
	expect(result.name).toBe("Test Suite");
	expect(result.notes).toHaveLength(0);
	expect(result.baseline).toBeUndefined();
	expect(result.scenes).toHaveLength(3);
	expect(result.scenes[0]).toHaveLength(1);
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
		timing: { iterations: 1, samples: 1 },
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

it("should call profiler hooks in order", async () => {
	const invocations: unknown[] = [];
	await run({
		name: "Test Suite",
		timing: false,
		params: {
			param: [11, 22],
		},
		profilers: [{
			onStart() {
				invocations.push(["onStart"]);
			},
			onScene(_, s) {
				invocations.push(["onScene", s.params]);
			},
			onCase(_, c) {
				invocations.push(["onCase", c.name]);
			},
			onFinish() {
				invocations.push(["onFinish"]);
			},
		}],
		setup(scene) {
			scene.bench("foo", noop);
			scene.bench("bar", noop);
		},
	});
	expect(invocations).toStrictEqual([
		["onStart"],
		["onScene", { param: 11 }],
		["onCase", "foo"],
		["onCase", "bar"],
		["onScene", { param: 22 }],
		["onCase", "foo"],
		["onCase", "bar"],
		["onFinish"],
	]);
});
