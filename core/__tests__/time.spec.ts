import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { PartialSuite, runProfilers, spin } from "./helper.js";
import { ExecutionTimeMeasurement, TimeProfiler, TimeProfilerOptions, unroll } from "../src/time.js";
import { BenchCase, defineSuite, ProfilingContext, Scene } from "../src/index.ts";

const mockMeasureRun = vi.spyOn(ExecutionTimeMeasurement.prototype, "run");

function measureTime(options: TimeProfilerOptions, suite?: PartialSuite) {
	const profiler = new TimeProfiler({
		iterations: 1,
		samples: 1,
		warmup: 0,
		...options,
	});
	return runProfilers([profiler], suite);
}

function mockZeroMeasurement(measurement: ExecutionTimeMeasurement) {
	measurement.measure = function (name, iterator, count)  {
		if (name === "Overhead") {
			return Promise.resolve([1, 1]);
		}
		return ExecutionTimeMeasurement.prototype.measure.call(this, name, iterator, count);
	};
}

it("should reduce overhead by unrolling", async () => {
	const iterations = 100;
	const factor = 100;

	const no = unroll(1, false);
	const unrolled = unroll(factor, false);

	const t1 = await no(noop, iterations * factor);
	const t2 = await unrolled(noop, iterations);

	expect(t2).toBeLessThan(t1); // Diff depends on performance.
});

it.each([
	[{ unrollFactor: 0 }, "The unrollFactor must be at least 1"],
	[{ samples: 0 }, "The number of samples must be at least 1"],
	[{ iterations: 0 }, "The number of iterations cannot be 0 or negative"],
	[{ iterations: "0m" }, "Iteration time cannot be 0"],
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
		setup: scene => scene.bench("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(25);
	expect(result.scenes[0].Test.time).toHaveLength(22);
});

it("should support specify number of iterations", async () => {
	const fn = vi.fn(spin);
	const result = await measureTime({
		iterations: 16,
		unrollFactor: 8,
	}, {
		setup: scene => scene.bench("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(16);
	expect(result.scenes[0].Test.time).toHaveLength(1);
});

it("should estimate number of iterations", async () => {
	const ctx = { info: noop } as any;

	const fn = () => spin();
	const scene = new Scene({});
	const case_ = new BenchCase(scene, "Test", fn, false);

	const measurement = new ExecutionTimeMeasurement(ctx, case_, {} as any);
	const [iterations, iter] = await measurement.estimate("100ms");

	expect(iter.calls).toBe(1);
	expect(iterations).toBeLessThan(105);
	expect(iterations).toBeGreaterThan(95);
});

// we mock heavy overhead to make the test stable.
it("should check zero measurement", async () => {
	const scene = new Scene({});
	scene.bench("Test", noop);

	const suite = defineSuite({
		setup: scene => scene.bench("Test", noop),
	});
	const ctx = new ProfilingContext(suite as any, [], { log: () => {} });
	const measurement = new ExecutionTimeMeasurement(ctx, scene.cases[0], {
		warmup: 0,
		iterations: "10ms",
		samples: 10,
		unrollFactor: 16,
		evaluateOverhead: true,
	});
	mockZeroMeasurement(measurement);

	const time = await measurement.run();

	expect(time).toStrictEqual([0]);
	expect(ctx.notes[0].type).toBe("warn");
	expect(ctx.notes[0].text).toBe("The function duration is indistinguishable from the empty function duration.");
});

it("should not set throughput for zero measurement", async () => {
	const mockProfiler = new TimeProfiler({
		warmup: 0,
		iterations: "10ms",
		samples: 10,
		throughput: "s",
	});
	mockMeasureRun.mockResolvedValue([0]);

	const result = await runProfilers([mockProfiler], {
		setup: scene => scene.bench("Test", noop),
	});

	expect(result.scenes[0].Test).toStrictEqual({});
});

it("should skip overhead stage if evaluateOverhead is false", async () => {
	const stubFn = vi.fn(noop);
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

	expect(result.meta.time).toBeDefined();

	const metrics = result.scenes[0].Test;
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
