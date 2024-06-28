import { describe, expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/node";
import { BenchCase, Scene, resolveParams } from "../src/suite.ts";

describe("Scene", () => {
	it("should reject blank case name", () => {
		const scene = new Scene(null);
		expect(() => scene.bench("\t \n", vi.fn())).toThrow();
	});

	it("should reject duplicated case name", () => {
		const scene = new Scene(null);
		scene.bench("Foo", vi.fn());
		expect(() => scene.bench("Foo", vi.fn())).toThrow();
	});
});

describe("BenchCase", () => {
	const scene = new Scene(null);
	const before = vi.fn();
	const after = vi.fn();
	scene.beforeIteration(before);
	scene.afterIteration(after);

	it("should call hooks on invoke", async () => {
		const invocations: unknown[] = [];
		const fn = () => invocations.push(fn);
		before.mockImplementation(() => invocations.push(before));
		after.mockImplementation(() => invocations.push(after));

		await new BenchCase(scene, "Test", fn, false).invoke();

		expect(invocations).toStrictEqual([before, fn, after]);
	});

	it("should return the value", () => {
		const case_ = new BenchCase(scene, "Test", () => 11, false);
		return expect(case_.invoke()).resolves.toBe(11);
	});

	it("should call hooks in invoke when error is thrown", async () => {
		const fn = () => Promise.reject(new Error("Stub"));
		const promise = new BenchCase(scene, "Test", fn, false).invoke();

		expect(before).toHaveBeenCalledOnce();
		expect(after).not.toHaveBeenCalled();

		await expect(promise).rejects.toThrow();
		expect(after).toHaveBeenCalledOnce();
	});

	it("should support derive with new workload", () => {
		const newFn = vi.fn();
		const case_ = new BenchCase(scene, "Test", noop, false);
		case_.id = 123;

		const derived = case_.derive(true, newFn);
		expect(derived.name).toBe("Test");
		expect(derived.id).toBe(123);
		expect(derived.isAsync).toBe(true);
		expect(derived.fn).toBe(newFn);
		expect(derived.beforeHooks).not.toBe(case_.beforeHooks);
		expect(derived.afterHooks).not.toBe(case_.afterHooks);
	});
});

describe("resolveParams", () => {
	it("should return entries array", () => {
		const [src, defs] = resolveParams({
			foo: {
				text: "A",
				bool: true,
			},
			bar: [11, 22, 33],
		});
		expect(src).toStrictEqual([
			["foo", ["A", true]],
			["bar", [11, 22, 33]],
		]);
		expect(defs).toStrictEqual([
			["foo", ["text", "bool"]],
			["bar", ["11", "22", "33"]],
		]);
	});

	it("should restrict keys to be string", () => {
		expect(() => resolveParams({ [Symbol()]: [11] }))
			.toThrow("Only string keys are allowed in param");
	});

	it("should fail if a property is builtin parameter", () => {
		expect(() => resolveParams({ Builder: [11] }))
			.toThrow("'Builder' is a builtin variable");
	});

	it("should fail if a parameter does not have value", () => {
		expect(() => resolveParams({ foo: [] }))
			.toThrow("Suite parameter \"foo\" must have a value");
	});

	it("should restrict parameters to have unique display names", () => {
		const params = {
			foo: ["1234567_A_1234567", "1234567_B_1234567"],
		};
		expect(() => resolveParams(params))
			.toThrow("Parameter display name conflict (foo: 1234567_…1234567)");
	});
});
