import { expect, it, vi } from "vitest";
import { noop } from "@kaciras/utilities/browser";
import { HostContext } from "../../src/host/context.ts";
import { SharedModeFilter } from "../../src/utils.ts";

it("should resolve filters", () => {
	const context = new HostContext({}, {
		name: /^foo/,
		builder: "-bar$",
		executor: "",
		shared: "1/3",
	});
	expect(context.filter).toStrictEqual({
		file: undefined,
		name: /^foo/,
		builder: /-bar$/,
		executor: new RegExp(""),
		shared: new SharedModeFilter(0, 3),
	});
});

it("should set minimum log level", () => {
	const context = new HostContext({ logLevel: "error" });
	const logWarn = vi.spyOn(console, "warn").mockImplementation(noop);
	const logError = vi.spyOn(console, "error").mockImplementation(noop);

	context.warn("Should not be logged");
	context.error("Should appear in logs");

	expect(logWarn).not.toHaveBeenCalledOnce();
	expect(logError).toHaveBeenCalledWith("[91mShould appear in logs[39m");
});
