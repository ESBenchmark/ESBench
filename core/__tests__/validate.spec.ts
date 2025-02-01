import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { Profiler, ProfilingContext } from "../src/index.js";
import { PartialSuite, runProfilers } from "./helper.js";
import { ExecutionValidator, ValidateOptions } from "../src/validate.js";
import { normalizeSuite } from "../src/suite.ts";

function runWithValidator(options: ValidateOptions<any>, suite: PartialSuite) {
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
	}, {
		setup(scene) {
			scene.bench("foo", () => 11);
			scene.bench("bar", () => 22);
		},
	});
	return expect(promise).rejects.toThrow(cause);
});

it("should be able to access scene parameters in check()", async () => {
	const check = vi.fn();

	await runWithValidator({ check }, {
		params: {
			a: [false, true],
		},
		setup(scene) {
			scene.bench("foo", () => 11);
		},
	});

	expect(check).toHaveBeenNthCalledWith(1, 11, { a: false });
	expect(check).toHaveBeenNthCalledWith(2, 11, { a: true });
});

it("should check return values are equal", () => {
	const promise = runWithValidator({
		equality: true,
	}, {
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

it("should inherit run suite options", async () => {
	const profiler = new ExecutionValidator({});
	const suite = normalizeSuite({
		setup(scene) {
			scene.debug("Debug message should be logged twice");
			scene.bench("A", noop);

			// Filtered out, so the running should success.
			scene.bench("B", () => { throw new Error(); });
		},
	});
	const options = { pattern: /A/, log: vi.fn() };
	const context = new ProfilingContext(suite, [profiler], options);

	await context.run();

	expect(options.log.mock.calls).toStrictEqual([
		["Validating benchmarks [Execution]...", "info"],
		["Debug message should be logged twice", "debug"],
		["Debug message should be logged twice", "debug"],
	]);
});
