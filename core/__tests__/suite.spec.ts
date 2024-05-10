import { describe, expect, it, vi } from "vitest";
import { BenchCase, Scene } from "../src/index.js";

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
	const before = vi.fn();
	const after = vi.fn();
	const scene = new Scene(null);
	scene.beforeIteration(before);
	scene.afterIteration(after);

	it("should call hooks on invoke", async () => {
		const case_ = new BenchCase(
			scene,
			"Test",
			() => 11,
			false,
		);
		expect(await case_.invoke()).toBe(11);
		expect(after).toHaveBeenCalledOnce();
		expect(before).toHaveBeenCalledOnce();
	});

	it("should call hooks in invoke when error is thrown", async () => {
		const case_ = new BenchCase(
			scene,
			"Test",
			() => { throw new Error(); },
			false,
		);
		await expect(case_.invoke()).rejects.toThrow();
		expect(after).toHaveBeenCalledOnce();
		expect(before).toHaveBeenCalledOnce();
	});
});
