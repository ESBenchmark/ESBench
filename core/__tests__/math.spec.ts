import { describe, expect, it } from "vitest";
import { TukeyOutlierDetector, welchTest } from "../src/math.js";

describe("removeOutliers", () => {
	it("should throw error with empty array", () => {
		expect(() => new TukeyOutlierDetector([])).toThrow();
	});

	it("should work with one-element array", () => {
		const detector = new TukeyOutlierDetector([11]);
		expect(detector.lowerFence).toBe(11);
		expect(detector.upperFence).toBe(11);
	});

	it("should support custom K value", () => {
		const values = [1, 7, 8, 9, 22];
		const detector = new TukeyOutlierDetector(values, 3);

		expect(detector.lowerFence).toBe(1);
		expect(detector.upperFence).toBe(15);
	});

	it("should works", () => {
		const values = [1, 7, 8, 9, 22];
		const detector = new TukeyOutlierDetector(values);

		expect(detector.isOutlier(11)).toBe(false);
		expect(detector.isOutlier(22)).toBe(true);

		expect(detector.filter(values)).toStrictEqual([7, 8, 9]);
		expect(detector.filter(values, "lower")).toStrictEqual([7, 8, 9, 22]);
		expect(detector.filter(values, "upper")).toStrictEqual([1, 7, 8, 9]);
	});
});

describe("welch's t-test", () => {
	it("should return NaN if variance are 0", () => {
		expect(welchTest([1, 1, 1], [2, 2, 2], "not equal")).toBeNaN();
	});

	it("should return NaN if sample size < 2", () => {
		expect(welchTest([], [], "not equal")).toBeNaN();
		expect(welchTest([1], [2], "not equal")).toBeNaN();
	});

	it("should throw error for invalid alternative hypothesis", () => {
		// @ts-expect-error
		expect(() => welchTest([1, 1], [2, 2], "foobar")).toThrow();
	});

	it.each([{
		a: [19.8, 20.4, 19.6, 17.8, 18.5, 18.9, 18.3, 18.9, 19.5, 22.0],
		b: [28.2, 26.6, 20.1, 23.3, 25.2, 22.1, 17.7, 27.6, 20.6, 13.7, 23.2, 17.5, 20.6, 18.0, 23.9, 21.6, 24.3, 20.4, 24.0, 13.2],
		notEqual: 0.035972,
		less: 0.017986,
		greater: 0.982013,
	}, {
		a: [0, 1, 1, 1],
		b: [1, 2, 2, 2],
		notEqual: 0.030019,
		less: 0.015009,
		greater: 0.984990,
	}])("should get display name of values %#", data => {
		expect(welchTest(data.a, data.b, "not equal")).closeTo(data.notEqual, 1e-6);
		expect(welchTest(data.a, data.b, "less")).closeTo(data.less, 1e-6);
		expect(welchTest(data.a, data.b, "greater")).closeTo(data.greater, 1e-6);
	});
});
