import { expect, it } from "vitest";
import { SummaryTable } from "../src/table.ts";
import { resultStub } from "./helper.ts";
import { createFormatter } from "../src/format.ts";

it("should throw error if no formatter found for the template", () => {
	expect(() => createFormatter("{INVALID}"))
		.toThrow('Metric type: "INVALID" does not have convertor');
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
