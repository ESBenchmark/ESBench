import { expect, it } from "vitest";
import { MetricAnalysis, SummaryTable, ToolchainResult } from "../src/index.js";
import { resultStub } from "./helper.ts";

it("should fail with invalid metric type", () => {
	const results: ToolchainResult[] = [{
		...resultStub,
		scenes: [{
			// @ts-expect-error
			foo: { time: false },
		}],
	}];
	expect(() => SummaryTable.from(results)).toThrow('Metric "time" must be an array');
});

it("should fail with invalid format", () => {
	const results: ToolchainResult[] = [{
		...resultStub,
		meta: {
			time: {
				format: "123456789",
				key: "time",
				analysis: 2,
				lowerIsBetter: true,
			},
		},
	}];
	const table = SummaryTable.from(results);
	expect(() => table.format()).toThrow("Invalid metric format: 123456789");
});

it("should works", () => {
	const table = SummaryTable.from([{
		...resultStub,
		scenes: [{
			foo: { time: [0, 1, 1, 1] },
			bar: { time: [1, 2, 2, 2] },
		}],
	}], undefined, {
		stdDev: false,
	});
	expect(table.cells).toStrictEqual([
		["No.", "Name", "time"],
		["0", "foo", 0.75],
		["1", "bar", 1.75],
	]);
	expect(table.hints).toHaveLength(0);
	expect(table.warnings).toHaveLength(0);
});

it("should support custom metrics", () => {
	const table = SummaryTable.from([{
		...resultStub,
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
	expect(table.cells).toStrictEqual([
		["No.", "foo", "foo.p50", "bar", "baz"],
		["0", 0.75, 1, 2048, "OOXX"],
	]);
});

it("should allow optional metrics value", () => {
	const table = SummaryTable.from([{
		...resultStub,
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
	expect(table.cells).toStrictEqual([
		["No.", "Name", "time", "time.SD", "time.ratio"],
		["0", "foo", undefined, undefined, "N/A"],
		["1", "bar", 1.75, 0.4330127018922193, "N/A"],
	]);
});

it.each([
	["percentage" as const, ["0.00%", "+100.00%", "-75.00%"]],
	["value" as const, ["1.00x", "2.00x", "0.25x"]],
	["trend" as const, ["100.00%", "200.00%", "25.00%"]],
])("should apply ratio style: %s", (style, values) => {
	const table = SummaryTable.from([{
		...resultStub,
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
		ratioStyle: style,
	});
	expect(table.cells[1][3]).toBe(values[0]);
	expect(table.cells[2][3]).toBe(values[1]);
	expect(table.cells[3][3]).toBe(values[2]);
});

it("should calculate ratio with previous", () => {
	const table = SummaryTable.from([{
		...resultStub,
		scenes: [{
			foo: { time: [0, 1, 1, 1] },
		}],
	}], [{
		...resultStub,
		scenes: [{
			foo: { time: [4, 3, 9, 6] },
		}],
	}]);
	expect(table.cells).toStrictEqual([
		["No.", "time", "time.SD", "time.diff"],
		["0", 0.75, 0.4330127018922193, "-86.36%"],
	]);
});

it("should keep blank if no matched previous value", () => {
	const table = SummaryTable.from([{
		...resultStub,
		scenes: [{
			foo: { time: [0, 1, 1, 1] },
			bar: {},
			baz: { time: [4, 3, 9, 6] },
		}],
	}], [{
		...resultStub,
		scenes: [{
			foo: {},
			bar: { time: [8, 9, 6, 4] },
		}],
	}]);
	expect(table.cells).toStrictEqual([
		["No.", "Name", "time", "time.SD", "time.diff"],
		["0", "foo", 0.75, 0.4330127018922193, undefined],
		["1", "bar", undefined, undefined, undefined],
		["2", "baz", 5.5, 2.29128784747792, undefined],
	]);
});

it("should add row number to notes if it associated with a case", () => {
	const table = SummaryTable.from([{
		...resultStub,
		notes: [{
			type: "info",
			caseId: 0,
			text: "Note text",
		}],
	}]);
	expect(table.hints).toStrictEqual(["[No.0] foo: Note text"]);
});

it("should remove all outliers", () => {
	const table = SummaryTable.from([{
		...resultStub,
		scenes: [{
			foo: { time: [0, 45, 50, 55, 100] },
		}],
	}]);
	expect(table.cells).toStrictEqual([
		["No.", "time", "time.SD"],
		["0", 50, 4.08248290463863],
	]);
	expect(table.hints).toStrictEqual(["[No.0] foo: 2 outliers were removed."]);
});

it("should remove best outliers", () => {
	const values = [0, 45, 50, 55, 100];
	const table = SummaryTable.from([{
		...resultStub,
		meta: {
			...resultStub.meta,
			money: {
				key: "money",
				analysis: 2,
				lowerIsBetter: false,
			},
		},
		scenes: [{
			foo: { time: values, money: values },
		}],
	}], undefined, {
		outliers: "best",
	});
	expect(table.cells).toStrictEqual([
		["No.", "time", "time.SD", "money", "money.SD"],
		["0", 62.5, 21.937410968480304, 37.5, 21.937410968480304],
	]);
});

it("should warn if the value of baseline does not in the table", () => {
	const table = SummaryTable.from([{
		...resultStub,
		baseline: {
			type: "Name",
			value: "XX",
		},
		scenes: [{
			A: { time: [4] },
			B: { time: [8] },
			C: { time: [1] },
		}],
	}]);
	expect(table.cells[0]).toHaveLength(4);
	expect(table.warnings).toStrictEqual(["Baseline { Name: XX } does not in the results."]);
});

it("should format undefined values in the table", () => {
	const table = SummaryTable.from([{
		...resultStub,
		scenes: [{
			foo: {},
			bar: { time: [1, 2, 2, 2] },
		}],
	}]);
	const formatted = table.format();
	expect(Array.from(formatted)).toStrictEqual([
		["No.", "Name", "time", "time.SD"],
		["0", "foo", "", ""],
		["1", "bar", "1.75 ms", "433.01 us"],
	]);
});

it("should throw error when a value is not suitable of the format", () => {
	const table = SummaryTable.from([{
		...resultStub,
		meta: {
			bar: { key: "bar", format: "{duration}" },
		},
		scenes: [{
			foo: { bar: "text" },
		}],
	}]);
	expect(() => table.format()).toThrow('Cannot apply number format to "text"');
});

it("should allow a column has different units", () => {
	const table = SummaryTable.from([{
		...resultStub,
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
