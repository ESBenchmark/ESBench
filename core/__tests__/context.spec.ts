import { expect, it } from "vitest";
import { ProfilingContext } from "../src/index.ts";

it("should not allow run twice",async () => {
	const context = new ProfilingContext({ name: "Test", setup() {} }, [], {});
	await context.run();
	await expect(context.run()).rejects.toThrow("A ProfilingContext can only be run once");
});
