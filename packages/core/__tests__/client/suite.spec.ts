import { expect, it, vi } from "vitest";
import { Scene } from "../../src/client/index.js";

it("should avoid blank workload name", () => {
	const scene = new Scene();
	expect(() => scene.add("\t \n", vi.fn())).toThrow();
});

it("should avoid duplicate workload name", () => {
	const scene = new Scene();
	scene.add("Foo", vi.fn());
	expect(() => scene.add("Foo", vi.fn())).toThrow();
});
