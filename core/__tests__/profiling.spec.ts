import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { BenchmarkSuite, Profiler, ProfilingContext } from "../src/index.ts";
import { consoleLogHandler } from "../src/utils.ts";

const emptySuite = { setup() {} };

it("should not allow run twice", async () => {
	const context = new ProfilingContext(emptySuite, [], {});
	await context.run();
	await expect(context.run()).rejects.toThrow("A ProfilingContext can only be run once");
});

it("should initialize properties", () => {
	const suite: BenchmarkSuite = {
		params: {
			foo: ["hello", "world", "!"],
			bar: [11, 22],
		},
		setup() {},
	};
	const context = new ProfilingContext(suite, [], {});

	expect(context.suite).toBe(suite);
	expect(context.profilers).toHaveLength(0);
	expect(context.pattern.source).toBe("(?:)");
	expect(context.logHandler).toBe(consoleLogHandler);
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
	const suite: BenchmarkSuite = {
		params: { param: [11, 22] },
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
		onCase: (_, c) => {c.invoke();},
	};
	const suite: BenchmarkSuite = {
		params: { param: [11, 22] },
		setup(scene) {
			scene.bench("test foo", foo);
			scene.bench("bar test", bar);
		},
	};

	await new ProfilingContext(suite, [profiler], { pattern: /^test/ }).run();

	expect(foo).toHaveBeenCalled();
	expect(bar).not.toHaveBeenCalled();
});
