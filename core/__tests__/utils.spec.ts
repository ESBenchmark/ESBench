import { describe, expect, it } from "vitest";
import { groupByPolyfill, SharedModeFilter, toDisplayName } from "../src/utils.js";

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
])("should get display name %#", (value, expected) => {
	expect(toDisplayName(value)).toBe(expected);
});

describe("SharedModeFilter", () => {
	it.each([
		"", "/", "foo", "#1/4", "1/4#",
		"-1/2", "1/0", "0/2", "3/2",
	])("should validate string: %s", option => {
		expect(() => SharedModeFilter.parse(option)).toThrow();
	});

	it("should always return true from roll() if option is 1/1", () => {
		const filter = SharedModeFilter.parse();
		expect(filter.roll()).toBe(true);
		expect(filter.roll()).toBe(true);
		expect(filter.roll()).toBe(true);
	});

	it("should roll", () => {
		const filter = new SharedModeFilter(1, 3);
		for (let i = 0; i < 2; i++) {
			expect(filter.roll()).toBe(false);
			expect(filter.roll()).toBe(true);
			expect(filter.roll()).toBe(false);
		}
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

it("should polyfill Map.groupBy", () => {
	const inventory = [
		{ name: "asparagus", type: "vegetables", quantity: 9 },
		{ name: "bananas", type: "fruit", quantity: 5 },
		{ name: "goat", type: "meat", quantity: 23 },
		{ name: "cherries", type: "fruit", quantity: 12 },
		{ name: "fish", type: "meat", quantity: 22 },
	];
	const restock = { restock: true };
	const sufficient = { restock: false };

	const result = groupByPolyfill(inventory, ({ quantity }) =>
		quantity < 6 ? restock : sufficient,
	);
	expect(result.get(sufficient)).toHaveLength(4);
	expect(result.get(restock)).toStrictEqual([
		{ name: "bananas", type: "fruit", quantity: 5 },
	]);
});
