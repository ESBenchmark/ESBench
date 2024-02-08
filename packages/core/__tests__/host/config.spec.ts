import { expect, it } from "vitest";
import { ESBenchConfig, normalizeConfig } from "../../src/host/index.js";

it.each<ESBenchConfig>([
	{ toolchains: [{ executors: [] }] },
	{ toolchains: [{ include: [] }] },
	{ toolchains: [] },
])("should fail when required option is empty", config => {
	expect(() => normalizeConfig(config)).toThrow();
});

it("should set default properties", () => {
	const config = normalizeConfig({});

	expect(config.tempDir).toBe(".esbench-tmp");
	expect(config.cleanTempDir).toBe(true);
	expect(config.reporters).toHaveLength(1);
	expect(config.toolchains).toHaveLength(1);

	const { include, builders, executors } = config.toolchains[0];
	expect(builders).toHaveLength(1);
	expect(executors).toHaveLength(1);
	expect(include).toStrictEqual(["./benchmark/**/*.[jt]s?(x)"]);
});

it("should not modify the user config", () => {
	const input = { toolchains: [{}] };
	const config = normalizeConfig(input);

	expect(config.toolchains).toHaveLength(1);
	expect(config.toolchains[0].builders).toHaveLength(1);
	expect(config.toolchains[0].executors).toHaveLength(1);
	expect(input).toStrictEqual({ toolchains: [{}] });
});

it("should fallback to singleton builder & executor", () => {
	const config = normalizeConfig({
		toolchains: [
			{ include: ["foo"] },
			{ include: ["bar"] },
		],
	});
	const [t0, t1] = config.toolchains;
	expect(t0.builders[0]).toBe(t1.builders[0]);
	expect(t0.executors[0]).toBe(t1.executors[0]);
});
