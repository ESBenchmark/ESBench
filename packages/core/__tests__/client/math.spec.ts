import { describe, expect, it } from "vitest";
import { welchTTest } from "../../src/client/math.js";

describe("welch's t-test", () => {
	it("should return NaN if variance are 0", () => {
		expect(welchTTest([1, 1, 1], [2, 2, 2], "not equal")).toBeNaN();
	});
	it("should return NaN if sample size < 2", () => {
		expect(welchTTest([], [], "not equal")).toBeNaN();
		expect(welchTTest([1], [2], "not equal")).toBeNaN();
	});

	it.each([{
		a: [19.8, 20.4, 19.6, 17.8, 18.5, 18.9, 18.3, 18.9, 19.5, 22.0],
		b: [28.2, 26.6, 20.1, 23.3, 25.2, 22.1, 17.7, 27.6, 20.6, 13.7, 23.2, 17.5, 20.6, 18.0, 23.9, 21.6, 24.3, 20.4, 24.0, 13.2],
		notEqual: 0.035972,
		less: 0.017986,
		greater: 0.982013,

		a: [0, 1, 1, 1],
		b: [1, 2, 2, 2],
		notEqual: 0.030019,
		less: 0.015009,
		greater: 0.984990,
	}])("should get display name of values %#", data => {
		expect(welchTTest(data.a, data.b, "not equal")).closeTo(data.notEqual, 1e-6);
		expect(welchTTest(data.a, data.b, "less")).closeTo(data.less, 1e-6);
		expect(welchTTest(data.a, data.b, "greater")).closeTo(data.greater, 1e-6);
	});
});
