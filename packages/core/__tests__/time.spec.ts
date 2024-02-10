import * as tp from "timers/promises";
import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { PartialSuite, runProfilers, sleep1 } from "./helper.js";
import { TimeProfiler, TimingOptions, unroll } from "../src/time.js";

function measureTime(options: TimingOptions, suite?: PartialSuite) {
	const profiler = new TimeProfiler({
		iterations: 1,
		samples: 1,
		warmup: 0,
		unrollFactor: 1,
		...options,
	});
	return runProfilers([profiler], suite);
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
	const fn = vi.fn(sleep1);
	const result = await measureTime({
		samples: 22,
	}, {
		setup: scene => scene.benchAsync("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(22);
	expect(result.scenes[0][0].metrics.time).toHaveLength(22);
});

it("should support specify number of iterations", async () => {
	const fn = vi.fn(sleep1);
	const result = await measureTime({
		iterations: 33,
	}, {
		setup: scene => scene.benchAsync("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(33);
	expect(result.scenes[0][0].metrics.time).toHaveLength(1);
});

it("should estimate number of iterations", async () => {
	const iterate = async (count: number) => {
		const start = performance.now();
		await tp.setTimeout(count);
		return performance.now() - start;
	};
	const profiler = new TimeProfiler({});
	const ctx = { info: noop } as any;

	const iterations = await profiler.estimate(ctx, iterate, "100ms");

	expect(iterations).toBeLessThan(110);
	expect(iterations).toBeGreaterThan(90);
});

it("should check zero measurement", async () => {
	const result = await measureTime({
		samples: 10,
		iterations: "10ms",
	}, {
		setup: scene => scene.bench("Test", noop),
	});
	expect(result.notes[0].type).toBe("warn");
	expect(result.notes[0].text).toBe("The function duration is indistinguishable from the empty function duration.");
	expect(result.scenes[0][0].metrics.time).toStrictEqual([0]);
});

it("should skip overhead stage if evaluateOverhead is false", async () => {
	const stubFn = vi.fn(noop);
	const result = await measureTime({
		evaluateOverhead: false,
	}, {
		setup: scene => scene.bench("Test", stubFn),
	});
	expect(stubFn).toHaveBeenCalledTimes(1);
	expect((result.scenes[0][0].metrics as any).time[0]).toBeGreaterThan(0);
});
