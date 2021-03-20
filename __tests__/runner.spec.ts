import { createParamsIter } from "../lib/runner";

it("should ", () => {
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
