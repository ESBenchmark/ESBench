import { expect, it } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { ProfilingContext } from "../src/index.ts";
import { run } from "./helper.ts";

it("should not allow run twice",async () => {
	const context = new ProfilingContext({ setup() {} }, [], {});
	await context.run();
	await expect(context.run()).rejects.toThrow("A ProfilingContext can only be run once");
});

it("should call profiler hooks in order", async () => {
	const invocations: unknown[] = [];
	await run({
		timing: false,
		params: {
			param: [11, 22],
		},
		profilers: [{
			onStart() {
				invocations.push(["onStart"]);
			},
			onScene(_, s) {
				invocations.push(["onScene", s.params]);
			},
			onCase(_, c) {
				invocations.push(["onCase", c.name]);
			},
			onFinish() {
				invocations.push(["onFinish"]);
			},
		}],
		setup(scene) {
			scene.bench("foo", noop);
			scene.bench("bar", noop);
		},
	});
	expect(invocations).toStrictEqual([
		["onStart"],
		["onScene", { param: 11 }],
		["onCase", "foo"],
		["onCase", "bar"],
		["onScene", { param: 22 }],
		["onCase", "foo"],
		["onCase", "bar"],
		["onFinish"],
	]);
});
