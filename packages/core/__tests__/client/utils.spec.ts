import { describe, expect, it } from "vitest";
import { checkParams, toDisplayName } from "../../src/client/utils.js";

describe("checkParams", () => {
	it.each([
		["looooooooooooooooooooooooooooooooooooooooooooooong", "looooooo…ooooong"],
		["", ""],

		[Object.create(null), "[object null]"],
		[{}, "[object Object]"],
		[{ foo: 11 }, "[object Object]"],

		[123, "123"],
		[undefined, "undefined"],
		[null, "null"],
		[true, "true"],

		[Symbol(), "symbol"],
		[Symbol("foo"), "symbol(foo)"],
	])("should get display name of values %#", (value, expected) => {
		expect(toDisplayName(value)).toBe(expected);
	});

	it("should restrict keys to be string", () => {
		expect(() => checkParams({ [Symbol()]: [11] }))
			.toThrow("Property with only string keys are allowed in param");
	});

	it("should fail if a property is builtin parameter", () => {
		expect(() => checkParams({ Builder: [11] }))
			.toThrow("'Builder' is a builtin parameter");
	});

	it("should restrict parameters to have unique display names", () => {
		const params = {
			foo: ["1234567_A_1234567", "1234567_B_1234567"],
		};
		expect(() => checkParams(params))
			.toThrow("Parameter display name conflict (foo: 1234567_…1234567)");
	});

	it("should return entries array", () => {

	});
});
