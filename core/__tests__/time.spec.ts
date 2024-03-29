import * as tp from "timers/promises";
import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { PartialSuite, runProfilers, spin1ms } from "./helper.js";
import { TimeProfiler, TimingOptions, unroll } from "../src/time.js";

function measureTime(options: TimingOptions, suite?: PartialSuite) {
	const profiler = new TimeProfiler({
		iterations: 1,
		samples: 1,
		warmup: 0,
		...options,
	});
	return runProfilers([profiler], suite);
}

function mockZeroMeasurement(profiler: TimeProfiler) {
	profiler.measure = (ctx, name, iterator, count) => {
		if (name === "Overhead") {
			return Promise.resolve([1, 1, 1]);
		}
		return TimeProfiler.prototype.measure.call(profiler, ctx, name, iterator, count);
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

it("should support specify number of samples", async () => {
	const fn = vi.fn(spin1ms);
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
	const fn = vi.fn(spin1ms);
	const result = await measureTime({
		iterations: 33,
		unrollFactor: 1,
	}, {
		setup: scene => scene.bench("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(33);
	expect(result.scenes[0].Test.time).toHaveLength(1);
});

it("should estimate number of iterations", async () => {
	const iterator = {
		calls: 1,
		async iterate(count: number) {
			const start = performance.now();
			await tp.setTimeout(count);
			return performance.now() - start;
		},
	};
	const profiler = new TimeProfiler({});
	const ctx = { info: noop } as any;

	const iterations = await profiler.estimate(ctx, iterator, "100ms");

	expect(iterations).toBeLessThan(110);
	expect(iterations).toBeGreaterThan(90);
});

// we mock heavy overhead to make the test stable.
it("should check zero measurement", async () => {
	const mockProfiler = new TimeProfiler({
		warmup: 0,
		iterations: "10ms",
		samples: 10,
	});
	mockZeroMeasurement(mockProfiler);

	const result = await runProfilers([mockProfiler], {
		setup: scene => scene.bench("Test", noop),
	});

	expect(result.notes[0].type).toBe("warn");
	expect(result.notes[0].text).toBe("The function duration is indistinguishable from the empty function duration.");
	expect(result.scenes[0].Test.time).toStrictEqual([0]);
});

it("should not set throughput for zero measurement", async () => {
	const mockProfiler = new TimeProfiler({
		warmup: 0,
		iterations: "10ms",
		samples: 10,
		throughput: "s",
	});
	mockZeroMeasurement(mockProfiler);

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
	expect((result.scenes[0].Test.time as any)[0]).toBeGreaterThan(0);
});

it("should measure time as duration", async () => {
	const result = await measureTime({
		iterations: 32,
	}, {
		setup: scene => scene.bench("Test", spin1ms),
	});

	expect(result.meta.time).toBeDefined();

	const metrics = result.scenes[0].Test;
	expect((metrics.time as number[])[0]).toBeCloseTo(1, 1);
});

it("should measure time as throughput", async () => {
	const result = await measureTime({
		throughput: "s",
		iterations: 32,
	}, {
		setup: scene => scene.bench("Test", spin1ms),
	});

	expect(result.meta.time).toBeUndefined();
	expect(result.meta.throughput).toBeDefined();

	const metrics = result.scenes[0].Test;
	const [throughput] = metrics.throughput as number[];
	expect(metrics.time).toBeUndefined();
	expect(throughput).toBeLessThan(1005);
	expect(throughput).toBeGreaterThan(995);
});
