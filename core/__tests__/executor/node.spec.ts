import { expect, it, vi } from "vitest";
import NodeExecutor from "../../src/executor/node.js";

const log = { level: "info", log: "log message" };
const empty = { name: "Test", paramDef: [], meta: {}, notes: [], scenes: [] };
const err = { e: { name: "Error", message: "Stub Error" } };

it("should transfer log messages", async () => {
	const dispatch = vi.fn();
	const executor = new NodeExecutor();

	await executor.execute({
		dispatch,
		root: "__tests__/fixtures/success-suite",
		tempDir: ".",
		files: ["./foo.js"],
	});

	const { calls } = dispatch.mock;
	expect(calls).toHaveLength(2);
	expect(calls[0][0]).toStrictEqual(log);
	expect(calls[1][0]).toStrictEqual(empty);
});

it("should forward errors from connect()", async () => {
	const dispatch = vi.fn(() => executor.close());
	const executor = new NodeExecutor();

	const promise = executor.execute({
		dispatch,
		root: "__tests__/fixtures/error-inside",
		tempDir: ".",
		files: ["./foo.js"],
	});

	await expect(promise).rejects.toThrow();
	expect(dispatch).toHaveBeenCalledOnce();
	expect(dispatch).toHaveBeenCalledWith(err, undefined);
});

it("should throw error if exception occurred outside connect()", () => {
	const dispatch = vi.fn();
	const executor = new NodeExecutor();

	const promise = executor.execute({
		dispatch,
		root: "__tests__/fixtures/error-outside",
		tempDir: ".",
		files: ["./foo.js"],
	});
	return expect(promise).rejects.toThrow("Node execute Failed (exitCode=1)");
});
