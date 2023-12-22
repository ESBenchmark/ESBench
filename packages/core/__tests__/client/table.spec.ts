import { expect, it } from "vitest";
import { createTable } from "../../src/client/index.js";

it.only("should works", () => {
	const { table, hints } = createTable([{
		paramDef: {},
		scenes: [[
			{ name: "foo", metrics: { time: [0, 1, 1, 1] } },
			{ name: "bar", metrics: { time: [1, 2, 2, 2] } },
		]],
	}]);
	expect(table).toStrictEqual([
		["No.", "Name", "time"],
		["0", "foo", "750.00 us"],
		["1", "bar", "1750.00 us"],
	]);
	expect(hints).toHaveLength(0);
});
