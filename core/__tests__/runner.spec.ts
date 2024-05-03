import { expect, it, vi } from "vitest";
import { run, spin1ms } from "./helper.js";
import { RunSuiteError } from "../src/index.js";

it("should return the result", async () => {
	const result = await run({
		params: {
			n: [10, 100, 1000],
		},
		baseline: {
			type: "n",
			value: 100,
		},
		setup(scene) {
			scene.bench("Test", spin1ms);
		},
	});
	expect(result.paramDef).toStrictEqual([
		["n", ["10", "100", "1000"]],
	]);
	expect(result.meta.time).toBeTypeOf("object");
	expect(result.notes).toHaveLength(0);
	expect(result.baseline).toStrictEqual({ type: "n", value: "100" });
	expect(result.scenes).toHaveLength(3);
	expect(result.scenes[0]).toBeTypeOf("object");
});

it("should call lifecycle hooks", async () => {
	const invocations: any[] = [];

	const beforeAll = () => invocations.push(beforeAll);
	const beforeEach = () => invocations.push(beforeEach);
	const beforeIter = () => invocations.push(beforeIter);
	const workload = () => invocations.push(workload);
	const afterIter = () => invocations.push(afterIter);
	const teardown = () => invocations.push(teardown);
	const afterAll = () => invocations.push(afterAll);

	await run({
		timing: { iterations: 1, samples: 1 },
		params: { n: [10, 100] },
		beforeAll,
		afterAll,
		setup(scene) {
			beforeEach();
			scene.teardown(teardown);
			scene.beforeIteration(beforeIter);
			scene.afterIteration(afterIter);
			scene.bench("Foo", workload);
		},
	});

	expect(invocations).toStrictEqual([
		beforeAll, beforeEach, beforeIter, workload, afterIter, teardown,
		beforeEach, beforeIter, workload, afterIter, teardown, afterAll,
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

it("should wrap exception with RunSuiteError", () => {
	// @ts-expect-error
	return expect(run({ setup: 1 })).rejects.toThrow(RunSuiteError);
});

it("should port params if the error threw from scene", async () => {
	const promise = run({
		params: {
			foo: [11],
			bar: [22, 33],
		},
		setup() {
			throw new Error("test");
		},
	});
	await expect(promise).rejects.toThrow(RunSuiteError);
	await expect(promise).rejects.toHaveProperty("params", { foo: 11, bar: 22 });
});

it.each([
	[{ type: "bar", value: 11 }],
	[{ type: "foo", value: 11 }],
])("should check parameter baseline %#", async (baseline) => {
	const promise = run({
		baseline,
		params: { bar: [22, 33] },
	});
	await expect(promise).rejects.toThrow(RunSuiteError);
});

it("should not check baseline that uses variable outside client", () => {
	return run({
		params: { bar: [22, 33] },
		baseline: { type: "Name", value: "NOT_EXISTS" },
	});
});
