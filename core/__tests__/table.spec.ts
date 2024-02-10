import { expect, it } from "vitest";
import { createTable, MetricAnalysis, MetricMeta } from "../src/index.js";

const time: MetricMeta = {
	format: "{duration.ms}",
	analysis: MetricAnalysis.Statistics,
};

const defaultResult = {
	name: "test",
	notes: [],
	paramDef: [],
	meta: { time },
};

it("should works", () => {
	const table = createTable([{
		...defaultResult,
		scenes: [[
			{ name: "foo", metrics: { time: [0, 1, 1, 1] } },
			{ name: "bar", metrics: { time: [1, 2, 2, 2] } },
		]],
	}]);
	expect(Array.from(table)).toStrictEqual([
		["No.", "Name", "time"],
		["0", "foo", "750.00 us"],
		["1", "bar", "1,750.00 us"],
	]);
	expect(table.hints).toHaveLength(0);
});

it("should allow a column has different units", () => {
	const table = createTable([{
		...defaultResult,
		scenes: [[
			{ name: "foo", metrics: { time: [0, 1, 1, 1] } },
			{ name: "bar", metrics: { time: [1, 2, 2, 2] } },
		]],
	}], undefined, {
		flexUnit: true,
	});
	expect(Array.from(table)).toStrictEqual([
		["No.", "Name", "time"],
		["0", "foo", "750 us"],
		["1", "bar", "1.75 ms"],
	]);
});

it("should support custom metrics", () => {
	const table = createTable([{
		...defaultResult,
		meta: {
			foo: { format: "{number}", analysis: MetricAnalysis.Statistics },
			bar: { format: "{dataSize.KiB}" },
			baz: {},
		},
		scenes: [[{
			name: "case 1",
			metrics: {
				foo: [0, 1, 1, 1],
				bar: 2048,
				baz: "OOXX",
				qux: "Hidden",
			},
		}]],
	}], undefined, {
		percentiles: [50],
	});
	expect(Array.from(table)).toStrictEqual([
		["No.", "Name", "foo", "foo.p50", "bar", "baz"],
		["0", "case 1", "0.75", "1.00", "2.00 MiB", "OOXX"],
	]);
});

it("should allow optional metrics value", () => {
	const table = createTable([{
		...defaultResult,
		baseline: {
			type: "Name",
			value: "foo",
		},
		scenes: [[
			{ name: "foo", metrics: {} },
			{ name: "bar", metrics: { time: [1, 2, 2, 2] } },
		]],
	}], undefined, {
		stdDev: true,
		percentiles: [75],
	});
	expect(Array.from(table)).toStrictEqual([
		["No.", "Name", "time", "time.SD", "time.p75", "time.ratio"],
		["0", "foo", "", "", "", "N/A"],
		["1", "bar", "1.75 ms", "433.01 us", "2.00 ms", "N/A"],
	]);
});

it.each([
	["percentage", ["0.00%", "+100.00%", "-75.00%"]],
	["value", ["1.00x", "2.00x", "0.25x"]],
	["trend", ["100.00%", "200.00%", "25.00%"]],
])("should apply ratio style: %s", (style, values) => {
	const table = createTable([{
		...defaultResult,
		baseline: {
			type: "Name",
			value: "A",
		},
		scenes: [[
			{ name: "A", metrics: { time: [4] } },
			{ name: "B", metrics: { time: [8] } },
			{ name: "C", metrics: { time: [1] } },
		]],
	}], undefined, {
		ratioStyle: style as any,
	});
	expect(table[1][3]).toBe(values[0]);
	expect(table[2][3]).toBe(values[1]);
	expect(table[3][3]).toBe(values[2]);
});
