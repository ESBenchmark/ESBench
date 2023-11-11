import { expect, it, vi } from "vitest";
import { run } from "./runner.spec.js";
import { defineSuite } from "../../src/client/index.js";
import { ValidationError } from "../../src/client/validate.js";

async function expectError(suite: any, properties: any) {
	properties.cause ??= undefined;
	const promise = run(suite);
	await expect(promise).rejects.toThrow(ValidationError);
	try {
		await promise;
	} catch (e) {
		const { message, cause, ...rest } = e;
		expect({ message, cause, ...rest }).toStrictEqual(properties);
	}
}

it("should not validate if the option is false", async () => {
	const cause = new TypeError("Stub Error");
	const previous = vi.fn();

	const suite = defineSuite({
		name: "Test Suite",
		config: {
			samples: 11,
		},
		setup(scene) {
			scene.bench("foo", previous);
			scene.bench("bar", () => {throw cause;});
		},
	});

	await expect(run(suite)).rejects.toThrow(cause);
	expect(previous).toHaveBeenCalledTimes(11);
});

it("should validate executions", async () => {
	const cause = new TypeError("Stub Error");
	const previous = vi.fn();

	const suite = defineSuite({
		name: "Test Suite",
		config: {
			samples: 2,
			validate: {},
		},
		params: {
			n: [10, 100, 1000],
		},
		setup(scene) {
			scene.bench("foo", previous);

			if (scene.params.n === 100) {
				scene.bench("bar", () => {throw cause;});
			}
		},
	});

	await expectError(suite, {
		cause,
		params: { n: 100 },
		workload: "bar",
		message: "Failed to execute benchmark \"bar\"",
	});
	expect(previous).toHaveBeenCalledTimes(2);
});

it("should validate the return value", () => {
	const cause = new TypeError("Stub Error");
	const suite = defineSuite({
		name: "Test Suite",
		config: {
			validate: {
				correctness: () => {throw cause;},
			},
		},
		setup(scene) {
			scene.bench("foo", () => 11);
			scene.bench("bar", () => 22);
		},
	});

	return expectError(suite, {
		cause,
		params: {},
		workload: "foo",
		message: "\"foo\" returns incorrect value",
	});
});

it("should check return values are equal", () => {
	const suite = defineSuite({
		name: "Test Suite",
		config: {
			validate: { equality: true },
		},
		setup(scene) {
			scene.bench("foo", () => 11);
			scene.bench("bar", () => 22);
		},
	});

	return expectError(suite, {
		params: {},
		workload: "bar",
		message: "\"foo\" and \"bar\" returns different value.",
	});
});

it("should support custom equality function", () => {
	const suite = defineSuite({
		name: "Test Suite",
		config: {
			validate: { equality: () => true },
		},
		setup(scene) {
			scene.bench("A", () => 11);
			scene.bench("B", () => 22);
		},
	});

	return expect(run(suite)).resolves.toBeTruthy();
});
