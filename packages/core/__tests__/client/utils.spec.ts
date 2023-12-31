import { describe, expect, it } from "vitest";
import { checkParams } from "../../src/client/utils.js";

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
		expect(checkParams({ _: [value] })._[0]).toBe(expected);
	});

	it("should restrict parameters to have unique display names", () => {
		const params = {
			foo: ["1234567_A_1234567", "1234567_B_1234567"],
		};
		expect(() => checkParams(params)).toThrow(/Parameter display name conflict/);
	});
});
