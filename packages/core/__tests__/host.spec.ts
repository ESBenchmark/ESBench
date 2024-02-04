import { expect, it, vi } from "vitest";
import { report } from "../src/host/host.js";
import result1And2 from "./fixtures/result-1+2.json" assert { type: " json" };

it("should merge results", async () => {
	const mockReporter = vi.fn();
	await report({
		reporters: [mockReporter],
	}, [
		"__tests__/fixtures/result-1.json",
		"__tests__/fixtures/result-2.json",
	]);
	expect(mockReporter).toHaveBeenCalledWith(result1And2, undefined);
});
