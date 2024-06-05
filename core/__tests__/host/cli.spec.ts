import nodeModule from "module";
import { afterAll, expect, it, MockedFunction, vi } from "vitest";
import { asyncNoop } from "@kaciras/utilities/node";
import { report, start } from "../../src/host/commands.js";

vi.mock("module", async importOriginal => {
	const module: any = await importOriginal();
	module.default.register = vi.fn();
	return {
		...module,
		register: module.default.register,
	};
});
vi.mock("../../src/host/commands.js");

const mockStart = (start as MockedFunction<typeof start>).mockImplementation(asyncNoop);
const mockReport = (report as MockedFunction<typeof report>).mockImplementation(asyncNoop);

const argvBackup = process.argv;

afterAll(() => {
	process.argv = argvBackup;
});

it("should pass empty object if no config found", async () => {
	vi.resetModules();
	await import("../../src/host/cli.js");

	const [config, filters] = mockStart.mock.calls[0];
	expect(nodeModule.register).toHaveBeenCalledOnce();
	expect(config).toStrictEqual({});
	for (const k of ["file", "builder", "executor", "name", "shared"]) {
		expect(filters).not.toHaveProperty(k);
	}
});

it("should not install TS loader with `--no-loader` argument", async () => {
	vi.resetModules();
	process.argv = ["node", "cli.js", "--no-loader"];
	await import("../../src/host/cli.js");

	expect(nodeModule.register).not.toHaveBeenCalled();
});

it("should x", async () => {
	process.argv = ["node", "cli.js", "report", "1.json", "2.json"];
	vi.resetModules();
	await import("../../src/host/cli.js");

	expect(mockStart).not.toHaveBeenCalled();
	expect(mockReport).toHaveBeenCalledWith({}, ["1.json", "2.json"]);
});
