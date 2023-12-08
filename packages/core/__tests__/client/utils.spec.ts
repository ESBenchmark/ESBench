import { describe, expect, it } from "vitest";
import { process } from "../../src/client/utils.js";

describe("process", () => {
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
		expect(process({ _: [value] }).paramDef._[0]).toBe(expected);
	});

	it("should return the number of cartesian cells", () => {
		const params = {
			foo: [1, 2, 3, 4],
			bar: [null],
			baz: ["a", "b"],
		};
		expect(process(params).length).toBe(8);
	});

	it("should restrict parameters to have unique display names", () => {
		const params = {
			foo: ["1234567_A_1234567", "1234567_B_1234567"],
		};
		expect(() => process(params)).toThrow(/Parameter display name conflict/);
	});
});
