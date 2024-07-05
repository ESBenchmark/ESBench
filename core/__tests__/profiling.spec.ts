import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { BenchCase, NormalizedSuite, Profiler, ProfilingContext, Scene } from "../src/index.ts";
import { emptySuite } from "./helper.ts";

it("should not allow run twice", async () => {
	const context = new ProfilingContext(emptySuite, [], {});
	await context.run();
	await expect(context.run()).rejects.toThrow("A ProfilingContext can only be run once");
});

it("should initialize properties", () => {
	const context = new ProfilingContext(emptySuite, [], {});

	expect(context.suite).toBe(emptySuite);
	expect(context.profilers).toHaveLength(0);
	expect(context.pattern.source).toBe("(?:)");
	expect(context.logHandler).toBeTypeOf("function");
});

it("should call profiler & scene hooks", async () => {
	const invocations: unknown[] = [];
	const profiler: Profiler = {
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
	};
	const suite: NormalizedSuite = {
		paramNames: [["param", ["11", "22"]]],
		params: [["param", [11, 22]]],
		setup(scene) {
			invocations.push(["setup"]);
			scene.bench("foo", noop);
			scene.bench("bar", noop);
			scene.teardown(() => invocations.push(["teardown"]));
		},
	};

	await new ProfilingContext(suite, [profiler], {}).run();

	expect(invocations).toStrictEqual([
		["onStart"],
		["setup"],
		["onScene", { param: 11 }],
		["onCase", "foo"],
		["onCase", "bar"],
		["teardown"],
		["setup"],
		["onScene", { param: 22 }],
		["onCase", "foo"],
		["onCase", "bar"],
		["teardown"],
		["onFinish"],
	]);
});

it("should filter workloads with pattern", async () => {
	const foo = vi.fn();
	const bar = vi.fn();

	const profiler: Profiler = {
		onCase: (_, c) => c.invoke(),
	};
	const suite: NormalizedSuite = {
		params: [],
		paramNames: [],
		setup(scene) {
			scene.bench("test foo", foo);
			scene.bench("bar test", bar);
		},
	};

	await new ProfilingContext(suite, [profiler], { pattern: /^test/ }).run();

	expect(foo).toHaveBeenCalled();
	expect(bar).not.toHaveBeenCalled();
});

it("should write logs to logHandler", () => {
	const log = vi.fn();
	const context = new ProfilingContext(emptySuite, [], { log });

	context.info("A info message");
	context.warn("A warning message");

	expect(context.notes).toHaveLength(0);
	expect(log).toHaveBeenCalledTimes(2);
	expect(log).toHaveBeenNthCalledWith(1, "A info message", "info");
	expect(log).toHaveBeenNthCalledWith(2, "A warning message", "warn");
});

it("should save and log notes", () => {
	const case_ = new BenchCase(new Scene({}), "test", noop, false);
	case_.id = 8964;
	const log = vi.fn();
	const context = new ProfilingContext(emptySuite, [], { log });

	context.note("info", "A info message");
	context.note("warn", "A warning message", case_);

	expect(log).toHaveBeenNthCalledWith(1, "A info message", "info");
	expect(log).toHaveBeenNthCalledWith(2, "A warning message", "warn");

	expect(context.notes).toStrictEqual([
		{ type: "info", text: "A info message", caseId: undefined },
		{ type: "warn", text: "A warning message", caseId: 8964 },
	]);
});
