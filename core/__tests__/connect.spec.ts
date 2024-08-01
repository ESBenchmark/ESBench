import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { runSuite } from "../src/runner.ts";
import { runAndSend } from "../src/index.ts";

vi.mock("./../src/runner.ts", async importOriginal => {
	return {
		...await importOriginal<any>(),
		runSuite: vi.fn(() => ({ scenes: [] })),
	};
});

const mockImporter = () => ({ default: noop });
const mockRun = vi.mocked(runSuite);

it("should resolve options for run", async () => {
	const postMessage = vi.fn();
	await runAndSend(postMessage, mockImporter, "./test", "^name$");

	const { log, pattern } = mockRun.mock.calls[0][1]!;
	await log!("foobar", "info");

	expect(pattern).toStrictEqual(/^name$/);
	expect(postMessage).toHaveBeenCalledWith({ log: "foobar", level: "info" });
});

it("should wait for send the result in runAndSend", async () => {
	const sending = Promise.resolve();
	const mockThen = vi.spyOn(sending, "then");

	await runAndSend(() => sending, mockImporter, "./test");
	expect(mockThen).toHaveBeenCalledOnce();
});

it("should serialize errors", async () => {
	const postMessage = vi.fn();
	const error = new TypeError("Stub", { cause: new Error("Cause") });
	mockRun.mockRejectedValue(error);

	await runAndSend(postMessage, mockImporter, "./test");
	expect(postMessage).toBeCalledTimes(2);

	const [{ e }] = postMessage.mock.calls[1];
	expect(e.name).toBe(error.name);
	expect(e.message).toBe(error.message);
	expect(e.cause.message).toBe("Cause");
	expect(Object.getPrototypeOf(e)).toBe(Object.prototype);
});
