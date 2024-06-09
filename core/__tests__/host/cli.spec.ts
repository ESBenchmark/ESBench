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

function runESBenchCLI(...args: string[]) {
	process.argv = ["node", "cli.js", ...args];
	vi.resetModules();
	return import("../../src/host/cli.js");
}

it("should pass empty object if no config found", async () => {
	await runESBenchCLI();

	const [config, filters] = mockStart.mock.calls[0];
	expect(nodeModule.register).toHaveBeenCalledOnce();
	expect(config).toStrictEqual({});
	for (const k of ["file", "builder", "executor", "name", "shared"]) {
		expect(filters).not.toHaveProperty(k);
	}
});

it("should not install TS loader with `--no-loader` argument", async () => {
	await runESBenchCLI("--no-loader");
	expect(nodeModule.register).not.toHaveBeenCalled();
});

it("should override log level by --logLevel", async () => {
	await runESBenchCLI("--logLevel=warn");
	expect(mockStart.mock.calls[0][0].logLevel).toBe("warn");
});

it("should generate report from saved results", async () => {
	await runESBenchCLI("report", "1.json", "2.json");
	expect(mockStart).not.toHaveBeenCalled();
	expect(mockReport).toHaveBeenCalledWith({}, ["1.json", "2.json"]);
});
