import nodeModule from "node:module";
import { asyncNoop, importCWD } from "@kaciras/utilities/node";
import { afterAll, expect, it, vi } from "vitest";
import { report, start } from "../../src/host/commands.js";

vi.mock("module", async importOriginal => {
	const module: any = await importOriginal();
	module.default.register = vi.fn();
	return {
		...module,
		register: module.default.register,
	};
});
vi.mock("@kaciras/utilities/node");
vi.mock("../../src/host/commands.js");

const mockStart = vi.mocked(start).mockImplementation(asyncNoop);
const mockReport = vi.mocked(report).mockImplementation(asyncNoop);

const argvBackup = process.argv;

afterAll(() => {
	process.argv = argvBackup;
});

function runESBenchCLI(...args: string[]) {
	process.argv = ["node", "cli.js", ...args];
	vi.resetModules();
	return import("../../src/host/cli.js");
}

it("should reject unknown options", async () => {
	const exit = vi.spyOn(process, "exit").mockReturnThis();
	await runESBenchCLI("--foo");

	expect(exit).toHaveBeenCalledWith(1);
	expect(mockStart).not.toHaveBeenCalled();
});

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

it("should add tags to config", async () => {
	await runESBenchCLI("--tag", "foo:11", "bar:22");
	expect(mockStart.mock.calls[0][0]).toStrictEqual({ tags: { foo: "11", bar: "22" } });
});

it("should merge tags with config's", async () => {
	vi.mocked(importCWD).mockResolvedValue({ tags: { baz: "33" } });
	await runESBenchCLI("--tag", "foo:11");
	expect(mockStart.mock.calls[0][0]).toStrictEqual({ tags: { foo: "11", baz: "33" } });
});
