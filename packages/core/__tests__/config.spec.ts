import { expect, it } from "vitest";
import { ESBenchConfig, normalizeConfig } from "../src/index.js";

it.each<ESBenchConfig>([
	{ stages: [{ executors: [] }] },
	{ stages: [{ include: [] }] },
	{ stages: [] },
])("should fail when required option is empty", config => {
	expect(() => normalizeConfig(config)).toThrow();
});

it("should set default properties", () => {
	const config = normalizeConfig({});

	expect(config.tempDir).toBe(".esbench-tmp");
	expect(config.cleanTempDir).toBe(true);
	expect(config.reporters).toHaveLength(1);
	expect(config.stages).toHaveLength(1);

	const { include ,builders, executors } = config.stages[0];
	expect(builders).toHaveLength(1);
	expect(executors).toHaveLength(1);
	expect(include).toStrictEqual(["./benchmark/**/*.[jt]s?(x)"]);
});

it("should not modify the user config", () => {
	const input = { stages: [{}] };
	const config = normalizeConfig(input);

	expect(config.stages).toHaveLength(1);
	expect(config.stages[0].builders).toHaveLength(1);
	expect(config.stages[0].executors).toHaveLength(1);
	expect(input).toStrictEqual({ stages: [{}] });
});
