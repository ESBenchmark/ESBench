import { expect, it, Mock, vi } from "vitest";
import { noop } from "@kaciras/utilities/node";
import { runSuite, RunSuiteError } from "../src/runner.ts";
import { defineSuite } from "../src/suite.ts";
import { ProfilingContext } from "../src/profiling.ts";
import { ExecutionValidator } from "../src/validate.ts";

vi.mock("./../src/profiling.ts", async importOriginal => {
	const module = await importOriginal<any>();
	return {
		...module,
		ProfilingContext: vi.fn((...args) => new module.ProfilingContext(...args)),
	};
});

const contextFactory = ProfilingContext as Mock;
const emptySuite = defineSuite({ setup: noop });

it("should return the result", async () => {
	contextFactory.mockReturnValue({
		run: async () => {},
		notes: [],
		meta: { time: {} },
		scenes: [{}, {}],
	});
	const result = await runSuite({
		params: {
			m: {
				foo: "A",
				bar: "B",
			},
			n: [10, 100, 1000],
		},
		baseline: {
			type: "n",
			value: 100,
		},
		setup() {},
	});
	expect(result.paramDef).toStrictEqual([
		["m", ["foo", "bar"]],
		["n", ["10", "100", "1000"]],
	]);
	expect(result.meta.time).toBeTypeOf("object");
	expect(result.notes).toHaveLength(0);
	expect(result.baseline).toStrictEqual({ type: "n", value: "100" });
	expect(result.scenes).toHaveLength(2);
	expect(result.scenes[0]).toBeTypeOf("object");
});

it("should create a ProfilingContext", async () => {
	contextFactory.mockReturnValue({ run: async () => {} });
	const options = { log: vi.fn(), pattern: /foo/ };

	await runSuite(emptySuite, options);

	const [suite, profilers, opts] = contextFactory.mock.calls[0];
	expect(suite).toStrictEqual({
		setup: noop,
		params: [],
		timing: {},
		paramNames: [],
	});
	expect(opts).toBe(options);
	expect(profilers).toHaveLength(2);
	expect(contextFactory).toHaveBeenCalledOnce();
});

it("should call lifecycle hooks", async () => {
	const invocations: unknown[] = [];

	const beforeAll = () => invocations.push(beforeAll);
	const afterAll = () => invocations.push(afterAll);
	const run = async () => {
		invocations.push(run);
		throw new Error("Stub Error");
	};
	contextFactory.mockReturnValue({ run });

	const running = runSuite({ beforeAll, afterAll, setup() {} });

	await expect(running).rejects.toThrow();
	expect(invocations).toStrictEqual([beforeAll, run, afterAll]);
});

it("should wrap exception with RunSuiteError", () => {
	const cause = new Error("Stub Error");
	const expected = new RunSuiteError("Error occurred when running suite.", cause);

	contextFactory.mockReturnValue({
		run: async () => { throw cause; },
	});

	return expect(runSuite(emptySuite)).rejects.toThrow(expected);
});

it("should port params if the error threw from scene", async () => {
	const promise = runSuite({
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
	[{ type: "foo", value: 22 }],
])("should check parameter baseline %#", async baseline => {
	const promise = runSuite({
		setup() {},
		baseline,
		params: { bar: [22, 33] },
	});
	await expect(promise).rejects.toThrow(RunSuiteError);
});

it("should not check baseline that uses variable outside client", async () => {
	const suite = {
		baseline: { type: "Name", value: "NOT_EXISTS" },
		setup() {},
		params: { bar: [22, 33] },
	};
	const result = await runSuite(suite, { log: vi.fn() });
	expect(result.baseline).toStrictEqual({ type: "Name", value: "NOT_EXISTS" });
});

it("should resolve built-in profilers", async () => {
	contextFactory.mockReturnValue({ run: async () => {} });
	const profiler1 = {};

	await runSuite({
		setup() {},
		timing: false,
		validate: {},
		profilers: [profiler1],
	});

	const [, profilers] = contextFactory.mock.calls[0];
	const class0 = Object.getPrototypeOf(profilers[0]).constructor;
	expect(class0.name).toBe("DefaultEventLogger");
	expect(profilers[2]).toBe(profiler1);
	expect(profilers[1]).toBeInstanceOf(ExecutionValidator);
});
