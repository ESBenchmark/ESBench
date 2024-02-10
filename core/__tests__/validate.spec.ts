import { expect, it, vi } from "vitest";
import { Profiler } from "../src/index.js";
import { PartialSuite, runProfilers } from "./helper.js";
import { ExecutionValidator, ValidateOptions } from "../src/validate.js";

function runWithValidator(options: ValidateOptions, suite: PartialSuite) {
	return runProfilers([new ExecutionValidator(options)], suite);
}

it("should validate the execution at the beginning", async () => {
	const e = new TypeError("Stub Error");
	const mockProfiler: Profiler = { onCase: vi.fn() };
	const profilers = [mockProfiler, new ExecutionValidator({})];

	const promise = runProfilers(profilers, {
		params: {
			n: [10, 100, 1000],
		},
		setup(scene) {
			scene.benchAsync("foo", vi.fn());
			if (scene.params.n === 100) {
				scene.bench("bar", () => {throw e;});
			}
		},
	});
	await expect(promise).rejects.toThrow(e);
	expect(mockProfiler.onCase).not.toHaveBeenCalled();
});

it("should validate the return value", () => {
	const cause = new TypeError("Stub Error");

	const promise = runWithValidator({
		check: () => { throw cause; },
	},{
		setup(scene) {
			scene.bench("foo", () => 11);
			scene.bench("bar", () => 22);
		},
	});
	return expect(promise).rejects.toThrow(cause);
});

it("should check return values are equal", () => {
	const promise = runWithValidator({
		equality: true,
	},{
		setup(scene) {
			scene.bench("foo", () => 11);
			scene.bench("bar", () => 22);
		},
	});
	return expect(promise).rejects.toThrow('"foo" and "bar" returns different value');
});

it("should support custom equality function", () => {
	const promise = runWithValidator({
		equality: () => true,
	}, {
		setup(scene) {
			scene.bench("A", () => 11);
			scene.bench("B", () => 22);
		},
	});
	return expect(promise).resolves.toBeTruthy();
});

it("should check equality in scene scope", () => {
	const promise = runWithValidator({
		equality: true,
	}, {
		params: {
			size: [11, 22],
		},
		setup(scene) {
			scene.bench("A", () => scene.params.size);
			scene.bench("B", () => scene.params.size);
		},
	});
	return expect(promise).resolves.toBeTruthy();
});
