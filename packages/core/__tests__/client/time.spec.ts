import { expect, it } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { run } from "./runner.spec.js";

it("should validate sample count", () => {
	const promise = run({
		timing: { samples: 0 },
		setup: (scene) => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should validate iteration count", () => {
	const promise = run({
		timing: { iterations: 0 },
		setup: (scene) => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
});

it("should validate iteration time", () => {
	const promise = run({
		timing: { iterations: "0m" },
		setup: (scene) => scene.bench("Test", noop),
	});
	expect(promise).rejects.toThrow();
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
	expect(result.scenes[0][0].metrics.time).toStrictEqual([0]);
});
