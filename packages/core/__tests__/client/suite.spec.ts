import { expect, it, vi } from "vitest";
import { Scene } from "../../src/client/index.js";

it("should avoid duplicate name", () => {
	const scene = new Scene();
	scene.add("Foo", vi.fn());
	expect(() => scene.add("Foo", vi.fn())).toThrow();
});
