import { createParamsIter } from "../src/utils.js";

describe("createParamsIter", () => {

	it("should accept empty object", () => {
		const params = Array.from(createParamsIter({}));

		expect(params).toHaveLength(1);
		expect(Object.keys(params[0])).toHaveLength(0);
	});

	it("should generate cartesian product", () => {
		const params = createParamsIter({
			a: [0, 1],
			b: [2, 3, 4],
		});
		const expected = expect.arrayContaining([
			{ a: 0, b: 2 },
			{ a: 0, b: 3 },
			{ a: 0, b: 4 },
			{ a: 1, b: 2 },
			{ a: 1, b: 3 },
			{ a: 1, b: 4 },
		]);
		expect(Array.from(params)).toEqual(expected);
	});
});
