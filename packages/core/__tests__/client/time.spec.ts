import * as tp from "timers/promises";
import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { run } from "./runner.spec.js";
import { unroll } from "../../src/client/time.js";

const sleep1 = tp.setTimeout.bind(null, 1);

vi.mock("../../src/client/math.js");

it("should reduce overhead by unrolling", async () => {
	const iterations = 100;
	const factor = 100;

	const no = unroll(1, false);
	const unrolled = unroll(factor, false);

	const t1 = await no(noop, iterations * factor);
	const t2 = await unrolled(noop, iterations);

	expect(t2).toBeLessThan(t1); // Diff depends on performance.
});

it("should validate sample count", () => {
	const promise = run({
		timing: { samples: 0 },
		setup: scene => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should validate iteration count", () => {
	const promise = run({
		timing: { iterations: 0 },
		setup: scene => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should validate iteration time", () => {
	const promise = run({
		timing: { iterations: "0m" },
		setup: scene => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should validate unrollFactor", () => {
	const promise = run({
		timing: { unrollFactor: 0 },
		setup: scene => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should support specify number of samples", async () => {
	const fn = vi.fn(sleep1);
	const result = await run({
		timing: { samples: 22 },
		setup: scene => scene.benchAsync("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(22);
	expect(result.scenes[0][0].metrics.time).toHaveLength(22);
});

it("should support specify number of iterations", async () => {
	const fn = vi.fn(sleep1);
	const result = await run({
		timing: { iterations: 33 },
		setup: scene => scene.benchAsync("Test", fn),
	});
	expect(fn).toHaveBeenCalledTimes(33);
	expect(result.scenes[0][0].metrics.time).toHaveLength(1);
});

it("should check zero measurement", async () => {
	const result = await run({
		timing: {
			samples: 10,
			iterations: "10ms",
		},
		setup: scene => scene.bench("Test", noop),
	});
	expect(result.notes[0].type).toBe("warn");
	expect(result.notes[0].text).toBe("The function duration is indistinguishable from the empty function duration.");
	expect(result.scenes[0][0].metrics.time).toStrictEqual([0]);
});
