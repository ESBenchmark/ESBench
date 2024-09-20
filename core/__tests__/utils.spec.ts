import { describe, expect, it } from "vitest";
import { CartesianProductMap, groupByPolyfill, SharedModeFilter, toDisplayName } from "../src/utils.js";

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
])("should convert param to short name %#", (value, expected) => {
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

describe("CartesianProductMap", () => {
	it("should check the size of values equals to number of cartesian product", () => {
		const src = [["foo", [11, 22]], ["baz", [55, 66, 77]]] as const;
		expect(() => new CartesianProductMap(src, new Array(5)))
			.toThrow("Values should have length = 6, but got 5");
	});

	it("should get index of the value", () => {
		const map = new CartesianProductMap([
			["foo", [11, 22]],
			["bar", [33, 44]],
			["baz", [55, 66, 77]],
		], Array.from({ length: 12 }, (_, i) => i));

		expect(map.getValue({ foo: 22, bar: 33, baz: 66 })).toBe(7);
	});

	it("should calculate src index from value index", () => {
		const map = new CartesianProductMap([
			["foo", [11, 22]],
			["bar", [33, 44]],
			["baz", [55, 66, 77]],
		], Array.from({ length: 12 }, (_, i) => i));

		expect(map.getSrcIndex(0, 7)).toBe(1);
		expect(map.getSrcIndex(1, 7)).toBe(0);
		expect(map.getSrcIndex(2, 7)).toBe(1);
	});

	it("should group the values", () => {
		const map = new CartesianProductMap([
			["foo", [11, 22]],
			["bar", [33, 44]],
			["baz", [55, 66, 77]],
			["qux", [88, 99]],
		], Array.from({ length: 24 }, (_, i) => i));

		expect(map.group([1, 2])).toStrictEqual([
			[0, 1, 12, 13],
			[2, 3, 14, 15],
			[4, 5, 16, 17],
			[6, 7, 18, 19],
			[8, 9, 20, 21],
			[10, 11, 22, 23],
		]);
	});
});
