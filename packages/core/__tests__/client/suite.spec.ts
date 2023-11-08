import { expect, it, vi } from "vitest";
import { Scene } from "../../src/client/index.js";

it("should avoid blank workload name", () => {
	const scene = new Scene();
	expect(() => scene.bench("\t \n", vi.fn())).toThrow();
});

it("should avoid duplicate workload name", () => {
	const scene = new Scene();
	scene.bench("Foo", vi.fn());
	expect(() => scene.bench("Foo", vi.fn())).toThrow();
});
