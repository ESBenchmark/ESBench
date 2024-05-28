import { expect, it, vi } from "vitest";
import { report } from "../../src/host/commands.ts";
import result1And2 from "../fixtures/merge-1+2.json" assert { type: " json" };

it("should merge results", async () => {
	const mockReporter = vi.fn();

	await report({
		reporters: [mockReporter],
	}, [
		"__tests__/fixtures/merge-1.json",
		"__tests__/fixtures/merge-2.json",
	]);

	const { calls } = mockReporter.mock;
	expect(calls).toHaveLength(1);
	expect(calls[0][0]).toStrictEqual(result1And2);
});
