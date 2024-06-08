import { mkdtempSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { expect, it } from "vitest";
import { resultStub, useTempDirectory } from "../helper.ts";
import { HostContext } from "../../src/host/context.ts";
import { textReporter } from "../../src/host/index.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
useTempDirectory(directory);

const file = join(directory, "report.txt");
const report = textReporter({ console: false, file });
const context = new HostContext({ logLevel: "off" });

it("should write to text file without color", async () => {
	await report({ perf: [resultStub] }, context);

	const output = readFileSync(file, "utf8");
	expect(output).toStrictEqual(readFileSync("__tests__/snapshots/text-report.txt", "utf8"));
});
