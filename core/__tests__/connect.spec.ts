import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { runSuite, RunSuiteError } from "../src/runner.ts";
import { runAndSend } from "../src/index.ts";

vi.mock("./../src/runner.ts", async importOriginal => {
	return {
		...await importOriginal<any>(),
		runSuite: vi.fn(() => []),
	};
});

const mockImporter = () => ({ default: noop });

it("should wait for send the result in runAndSend", async () => {
	const sending = Promise.resolve();
	const mock = vi.spyOn(sending, "then");

	await runAndSend(() => sending, mockImporter, "./test");
	expect(mock).toHaveBeenCalledOnce();
});

it("should serialize errors", async () => {
	const postMessage = vi.fn();
	const error = new RunSuiteError("Stub", new Error("Cause"));
	vi.mocked(runSuite).mockRejectedValue(error);

	await runAndSend(postMessage, mockImporter, "./test");

	expect(postMessage).toBeCalledTimes(2);
	const [{ e }] = postMessage.mock.calls[1];
	expect(e.name).toBe(error.name);
	expect(e.message).toBe(error.message);
	expect(e.cause.message).toBe("Cause");
	expect(Object.getPrototypeOf(e)).toBe(Object.prototype);
});
