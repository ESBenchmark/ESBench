import { expect, it } from "vitest";
import { createTable, MetricsAnalysis } from "../src/index.js";

const time = {
	format: "{duration.ms}",
	analyze: MetricsAnalysis.Statistics,
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
			foo: { format: "{number}", analyze: MetricsAnalysis.Statistics },
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
