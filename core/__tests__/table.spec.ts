import { expect, it } from "vitest";
import { buildSummaryTable, MetricAnalysis, MetricMeta } from "../src/index.js";

const time: MetricMeta = {
	key: "time",
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
	const table = buildSummaryTable([{
		...defaultResult,
		scenes: [{
			foo: { time: [0, 1, 1, 1] },
			bar: { time: [1, 2, 2, 2] },
		}],
	}], undefined, {
		stdDev: false,
	});
	expect(table.header).toStrictEqual(
		["No.", "Name", "time"],
	);
	expect(table.body).toStrictEqual([
		["0", "foo", 0.75],
		["1", "bar", 1.75],
	]);
	expect(table.hints).toHaveLength(0);
	expect(table.warnings).toHaveLength(0);
});

it("should support custom metrics", () => {
	const table = buildSummaryTable([{
		...defaultResult,
		meta: {
			foo: {
				key: "foo",
				format: "{number}",
				analysis: MetricAnalysis.Statistics,
			},
			bar: {
				key: "bar",
				format: "{dataSize.KiB}",
			},
			baz: { key: "baz" },
		},
		scenes: [{
			"case 1": {
				foo: [0, 1, 1, 1],
				bar: 2048,
				baz: "OOXX",
				qux: "Hidden",
			},
		}],
	}], undefined, {
		stdDev: false,
		percentiles: [50],
	});
	expect(table.header).toStrictEqual(
		["No.", "Name", "foo", "foo.p50", "bar", "baz"],
	);
	expect(table.body).toStrictEqual([
		["0", "case 1", 0.75, 1, 2048, "OOXX"],
	]);
});

it("should allow optional metrics value", () => {
	const table = buildSummaryTable([{
		...defaultResult,
		baseline: {
			type: "Name",
			value: "foo",
		},
		scenes: [{
			foo: {},
			bar: { time: [1, 2, 2, 2] },
		}],
	}], undefined, {
		outliers: false,
	});
	expect(table.header).toStrictEqual(
		["No.", "Name", "time", "time.SD", "time.ratio"],
	);
	expect(table.body).toStrictEqual([
		["0", "foo", undefined, undefined, "N/A"],
		["1", "bar", 1.75, 0.4330127018922193, "N/A"],
	]);
});

it.each([
	["percentage", ["0.00%", "+100.00%", "-75.00%"]],
	["value", ["1.00x", "2.00x", "0.25x"]],
	["trend", ["100.00%", "200.00%", "25.00%"]],
])("should apply ratio style: %s", (style, values) => {
	const table = buildSummaryTable([{
		...defaultResult,
		baseline: {
			type: "Name",
			value: "A",
		},
		scenes: [{
			A: { time: [4] },
			B: { time: [8] },
			C: { time: [1] },
		}],
	}], undefined, {
		stdDev: false,
		ratioStyle: style as any,
	});
	expect(table.body[0][3]).toBe(values[0]);
	expect(table.body[1][3]).toBe(values[1]);
	expect(table.body[2][3]).toBe(values[2]);
});

it("should allow a column has different units", () => {
	const table = buildSummaryTable([{
		...defaultResult,
		scenes: [{
			foo: { time: [0, 1, 1, 1] },
			bar: { time: [1, 2, 2, 2] },
		}],
	}], undefined, {
		stdDev: false,
	});
	const formatted = table.format({ flexUnit: true });
	expect(Array.from(formatted)).toStrictEqual([
		["No.", "Name", "time"],
		["0", "foo", "750 us"],
		["1", "bar", "1.75 ms"],
	]);
});

it("should calculate ratio with previous", () => {
	const table = buildSummaryTable([{
		...defaultResult,
		scenes: [{
			foo: { time: [0, 1, 1, 1] },
		}],
	}], [{
		...defaultResult,
		scenes: [{
			foo: { time: [4, 3, 9, 6] },
		}],
	}]);
	expect(table.header).toStrictEqual(
		["No.", "Name", "time", "time.SD", "time.diff"],
	);
	expect(table.body).toStrictEqual([
		["0", "foo", 0.75, 0.4330127018922193, "-86.36%"],
	]);
});
