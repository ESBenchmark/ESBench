import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it, vi } from "vitest";
import { resultStub, useTempDirectory } from "../helper.ts";
import { HostContext } from "../../src/host/context.ts";
import { textReporter } from "../../src/host/index.ts";
import { ToolchainResult } from "../../src/index.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
useTempDirectory(directory);

const file = join(directory, "report.txt");
const context = new HostContext({ logLevel: "off" });

it("should write to stdout with color", async () => {
	let output = "";
	const write = vi.spyOn(process.stdout, "write");
	write.mockImplementation(c => {
		output += c;
		return true;
	});

	const results: ToolchainResult[] = [{
		...resultStub,
		notes: [{
			type: "info",
			text: "This is info message",
		}, {
			type: "warn",
			text: "This is warn message",
		}],
	}];
	await textReporter()({ perf: results }, context);

	expect(output).toStrictEqual(readFileSync("__tests__/snapshots/text-report-colored.txt", "utf8"));
});

it("should write to text file without color", async () => {
	const report = textReporter({ console: false, file });
	await report({ perf: [resultStub] }, context);

	const output = readFileSync(file, "utf8");
	expect(output).toStrictEqual(readFileSync("__tests__/snapshots/text-report.txt", "utf8"));
});
