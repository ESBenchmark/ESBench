import { expect, it, vi } from "vitest";
import { cartesianArray, noop } from "@kaciras/utilities/node";
import { emptySuite, PartialSuite, runProfilers, spin } from "./helper.js";
import { ExecutionTimeMeasurement, TimeProfiler, TimeProfilerOptions } from "../src/time.js";
import { BenchCase, ProfilingContext, Scene } from "../src/index.ts";

function newContext() {
	return new ProfilingContext(emptySuite, [], { log: noop });
}

function measureTime(options: TimeProfilerOptions, suite?: PartialSuite) {
	const profiler = new TimeProfiler({
		iterations: 1,
		samples: 1,
		warmup: 0,
		...options,
	});
	return runProfilers([profiler], suite);
}

// Mock heavy overhead to make the test stable and fast.
function mockZeroMeasurement(measurement: ExecutionTimeMeasurement) {
	measurement.measure = function (name, iterator) {
		if (name === "Overhead") {
			return Promise.resolve([22, 22]);
		}
		if (name === "Actual") {
			return Promise.resolve([1, 1]);
		}
		return ExecutionTimeMeasurement.prototype.measure.call(this, name, iterator);
	};
}

it.each([
	[{ unrollFactor: 0 }, "The unrollFactor must be at least 1"],
	[{ samples: 0 }, "The number of samples must be at least 1"],
	[{ iterations: 0 }, "The number of iterations cannot be 0 or negative"],
	[{ iterations: "0m" }, "Iteration time must be > 0"],
	[{ iterations: "-2s" }, "Iteration time must be > 0"],
	[
		{ unrollFactor: 2, iterations: 3 },
		"iterations must be a multiple of unrollFactor",
	],
])("should validate options %#", (options, msg) => {
	return expect(async () => measureTime(options)).rejects.toThrow(msg);
});

it("should run iteration hooks", async () => {
	const invocations: unknown[] = [];
	await measureTime({
		iterations: 2,
	}, {
		setup(scene) {
			scene.beforeIteration(() => invocations.push("before"));
			scene.afterIteration(() => invocations.push("after"));
			scene.bench("A", () => invocations.push("bench A"));
			scene.benchAsync("B", () => invocations.push("bench B"));
		},
	});
	expect(invocations).toStrictEqual([
		"before", "bench A", "after", "before", "bench A", "after",
		"before", "bench B", "after", "before", "bench B", "after",
	]);
});

it("should support specify number of samples", async () => {
	const fn = vi.fn(spin);
	const result = await measureTime({
		warmup: 3,
		samples: 22,
	}, {
		setup: scene => scene.benchAsync("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(25);
	expect(result.scenes[0].Test.time).toHaveLength(22);
});

it("should support specify number of iterations", async () => {
	const fn = vi.fn();
	const result = await measureTime({
		iterations: 16,
		unrollFactor: 8,
	}, {
		setup: scene => scene.bench("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(16);
	expect(result.scenes[0].Test.time).toHaveLength(1);
});

const params = cartesianArray([
	[true, false],
	[
		[0.1, "175ms", 1750, 16],
		[1, "100ms", 100, 1],
		[42, "100ms", 2, 1],
	],
]);

it.each(Array.from(params))("should estimate iterations %#", async (hook, profile) => {
	const [delay, time, i, unroll] = profile;
	const scene = new Scene({});
	if (hook) {
		scene.beforeIteration(noop);
	}
	const case_ = new BenchCase(scene, "Test", () => spin(delay), false);

	const etm = new ExecutionTimeMeasurement(newContext(), case_);
	const iter = await etm.estimate(time);

	expect(iter.calls).toBe(unroll);
	expect(Math.round(iter.invocations)).toBeLessThan(i * 1.07); // ±5%
	expect(Math.round(iter.invocations)).toBeGreaterThan(i * 0.93);
});

it("should take iteration hooks into account in estimate", async () => {
	const scene = new Scene({});
	scene.beforeIteration(() => spin(20));
	const case_ = new BenchCase(scene, "Test", () => spin(20), false);

	const measurement = new ExecutionTimeMeasurement(newContext(), case_);
	expect((await measurement.estimate("100ms")).invocations).toBe(2);
});

// This should not happen, unless `now()` is implemented incorrectly.
it("should fail on too large invocation count", () => {
	const case_ = new BenchCase(new Scene({}), "Test", noop, false);

	// `performance.now()` is always called in pairs.
	let callNumber = 0;
	vi.spyOn(performance, "now").mockImplementation(() => {
		return (callNumber++ & 1) === 0 ? 0 : Number.EPSILON;
	});

	const etm = new ExecutionTimeMeasurement(newContext(), case_);
	return expect(etm.estimate("1d")).rejects
		.toThrow("Iteration time is too long and the fn runs too fast");
});

it("should check zero measurement", async () => {
	const case_ = new BenchCase(new Scene({}), "Test", noop, false);
	const ctx = newContext();

	const measurement = new ExecutionTimeMeasurement(ctx, case_, { iterations: 1 });
	mockZeroMeasurement(measurement);

	await measurement.run();
	expect(measurement.values).toStrictEqual([0]);
	expect(ctx.notes).toStrictEqual([{
		caseId: undefined,
		type: "warn",
		text: "The function duration is indistinguishable from the empty function duration.",
	}]);
});

it("should not set throughput for zero measurement", async () => {
	const run = vi.spyOn(ExecutionTimeMeasurement.prototype, "run");
	run.mockImplementation(async function (this: ExecutionTimeMeasurement) {
		this.values = [0];
	});
	const mockProfiler = new TimeProfiler({ throughput: "s" });

	const result = await runProfilers([mockProfiler]);
	expect(result.scenes[0].Test).toStrictEqual({});
});

it("should skip overhead stage if evaluateOverhead is false", async () => {
	const stubFn = vi.fn();
	const result = await measureTime({
		evaluateOverhead: false,
	}, {
		setup: scene => scene.bench("Test", stubFn),
	});
	expect(stubFn).toHaveBeenCalledTimes(1);
	expect((result.scenes[0].Test.time as number[])[0]).toBeGreaterThan(0);
});

it("should measure time as duration", async () => {
	const result = await measureTime({
		iterations: 32,
	}, {
		setup: scene => scene.bench("Test", spin),
	});

	const metrics = result.scenes[0].Test;
	expect(result.meta.time).toBeDefined();
	expect((metrics.time as number[])[0]).toBeCloseTo(1, 1);
});

it("should measure time as throughput", async () => {
	const result = await measureTime({
		throughput: "s",
		iterations: 512,
	}, {
		setup: scene => scene.bench("Test", spin),
	});

	expect(result.meta.time).toBeUndefined();
	expect(result.meta.throughput).toBeDefined();

	const metrics = result.scenes[0].Test;
	const [throughput] = metrics.throughput as number[];
	expect(metrics.time).toBeUndefined();
	expect(throughput).toBeLessThan(1005);
	expect(throughput).toBeGreaterThan(985);
});

it("should set throughput value in decimal", async () => {
	const result = await measureTime({
		throughput: "ms",
		iterations: 10,
	}, {
		setup: scene => scene.bench("Test", () => spin(10)),
	});

	const metrics = result.scenes[0].Test;
	const [throughput] = metrics.throughput as number[];
	expect(throughput).toBeCloseTo(0.1, 2);
});
