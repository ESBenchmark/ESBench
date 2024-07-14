import { expect, it, Mock, vi } from "vitest";
import { noop } from "@kaciras/utilities/node";
import { runSuite } from "../src/runner.ts";
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

it.each([
	[{ type: "Name", value: 11 }, "Value of baseline (Name) must be a string"],
	[{ type: "tag", value: 22 }, "Value of the host-side variable (tag) must be a string"],
	[{ type: "bar", value: 11 }, "Baseline value (11) does not in params[bar]"],
])("should check parameter baseline %#", async (baseline, error) => {
	const promise = runSuite({
		setup() {},
		baseline,
		params: { bar: [22, 33] },
	});
	await expect(promise).rejects.toThrow(error);
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
