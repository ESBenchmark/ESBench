import { expect, it, vi } from "vitest";
import { BenchmarkSuite, runAndSend } from "../src/index.ts";
import { spin1ms } from "./helper.ts";

it("should wait for send the result in runAndSend", async () => {
	const sending = Promise.resolve();
	const mock = vi.spyOn(sending, "then");
	const suite: BenchmarkSuite = {
		timing: {
			warmup: 0,
			iterations: 1,
		},
		setup(scene) {
			scene.bench("Test", spin1ms);
		},
	};
	await runAndSend(
		() => sending,
		() => ({ default: suite }),
		["Test Suite"],
	);
	expect(mock).toHaveBeenCalledOnce();
});
