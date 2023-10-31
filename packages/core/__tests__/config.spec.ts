import { expect, it } from "vitest";
import { ESBenchConfig, normalizeConfig } from "../src/index.js";

it.each<ESBenchConfig>([
	{ stages: [{ engines: [] }] },
	{ stages: [] },
	{ include: [] },
])("should fail when required option is empty #%", config => {
	expect(() => normalizeConfig(config)).toThrow();
});

it("should set default properties", () => {
	const config = normalizeConfig({});
	expect(config.tempDir).toBe(".esbench-tmp");
	expect(config.include).toStrictEqual(["benchmark/**/*.[jt]s?(x)"]);
	expect(config.cleanTempDir).toBe(true);
	expect(config.reporters).toHaveLength(1);
	expect(config.stages).toHaveLength(1);
	expect(config.stages[0].builder.name).toBe("NoBuild");
	expect(config.stages[0].engines).toHaveLength(1);
});

it("should not modify the user config", () => {
	const input = { stages: [{}] };
	const config = normalizeConfig(input);

	expect(config.stages).toHaveLength(1);
	expect(config.stages[0].builder.name).toBe("NoBuild");
	expect(config.stages[0].engines).toHaveLength(1);
	expect(input).toStrictEqual( { stages: [{}] });
});
