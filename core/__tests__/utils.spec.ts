import { describe, expect, it } from "vitest";
import { checkParams, SharedModeFilter, toDisplayName } from "../src/utils.js";

describe("checkParams", () => {
	it.each([
		["looooooooooooooooooooooooooooooooooooooooooooooong", "looooooo…ooooong"],
		["", ""],

		[Object.create(null), "[object null]"],
		[{}, "[object Object]"],
		[{ foo: 11 }, "[object Object]"],
		[[11, 22], "[11,22]"],

		[123, "123"],
		[undefined, "undefined"],
		[null, "null"],
		[true, "true"],

		[Symbol(), "Symbol()"],
		[Symbol("foo"), "Symbol(foo)"],
		[Symbol("looooooooooooooooooooong"), "Symbol(looo…ong)"],

		[() => {}, "Anonymous fn"],
		[function foo() {}, "foo"],
		[class BarBaz {}, "BarBaz"],
	])("should get display name of values %#", (value, expected) => {
		expect(toDisplayName(value)).toBe(expected);
	});

	it("should return entries array", () => {
		const paramDef = checkParams({
			foo: ["text"],
			bar: [11, 22, 33],
		});
		expect(paramDef).toStrictEqual([
			["foo", ["text"]],
			["bar", ["11", "22", "33"]],
		]);
	});

	it("should restrict keys to be string", () => {
		expect(() => checkParams({ [Symbol()]: [11] }))
			.toThrow("Only string keys are allowed in param");
	});

	it("should fail if a property is builtin parameter", () => {
		expect(() => checkParams({ Builder: [11] }))
			.toThrow("'Builder' is a builtin variable");
	});

	it("should fail if a parameter does not have value", () => {
		expect(() => checkParams({ foo: [] }))
			.toThrow("Suite parameter \"foo\" must have a value");
	});

	it("should restrict parameters to have unique display names", () => {
		const params = {
			foo: ["1234567_A_1234567", "1234567_B_1234567"],
		};
		expect(() => checkParams(params))
			.toThrow("Parameter display name conflict (foo: 1234567_…1234567)");
	});
});

describe("SharedModeFilter", () => {
	it.each([
		"", "/", "foo", "#1/4", "1/4#",
		"-1/2", "1/0", "0/2", "3/2",
	])("should validate string: %s", option => {
		expect(() => SharedModeFilter.parse(option)).toThrow();
	});

	it("should parse the string", () => {
		const filter = SharedModeFilter.parse("1/4");
		expect(filter.index).toBe(0);
		expect(filter.count).toBe(4);
	});

	it("should filter items", () => {
		const filter = new SharedModeFilter(0, 4);
		const array = new Array(10).fill(11);
		expect(filter.select(array)).toHaveLength(3);
	});

	it("should not filter out items by default", () => {
		const filter = new SharedModeFilter(0, 1);
		const array = new Array(10).fill(11);
		expect(filter.select(array)).toHaveLength(10);
	});

	it("should keep the internal counter", () => {
		const filter = new SharedModeFilter(0, 4);
		expect(filter.select([11])).toHaveLength(1);
		expect(filter.select([11, 22])).toHaveLength(0);
		expect(filter.select([11, 22])).toHaveLength(1);
	});
});
