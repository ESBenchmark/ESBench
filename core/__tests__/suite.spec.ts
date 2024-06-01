import { describe, expect, it, vi } from "vitest";
import { BenchCase, Scene } from "../src/index.js";
import { noop } from "@kaciras/utilities/browser";

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
