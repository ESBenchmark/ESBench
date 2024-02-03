import { expect, it } from "vitest";
import { createTable, MetricsAnalysis } from "../../src/client/index.js";

const time = {
	format: "{duration.ms}",
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
