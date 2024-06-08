import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { HostContext } from "../../src/host/index.ts";

it("should set minimum log level", () => {
	const context = new HostContext({ logLevel: "error" });
	const logWarn = vi.spyOn(console, "warn").mockImplementation(noop);
	const logError = vi.spyOn(console, "error").mockImplementation(noop);

	context.warn("Should not be logged");
	context.error("Should appear in logs");

	expect(logWarn).not.toHaveBeenCalledOnce();
	expect(logError).toHaveBeenCalledWith("[91mShould appear in logs[39m");
});
