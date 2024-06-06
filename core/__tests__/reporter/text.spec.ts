import { mkdtempSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { expect, it } from "vitest";
import { resultStub, useTempDirectory } from "../helper.ts";
import { createLogger } from "../../src/host/logger.ts";
import { textReporter } from "../../src/host/index.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
useTempDirectory(directory);

const file = join(directory, "report.txt");
const report = textReporter({ console: false, file });
const logger = createLogger("off");

it("should write to text file without color", async () => {
	await report({ perf: [resultStub] }, {}, logger);

	const output = readFileSync(file, "utf8");
	expect(output).toStrictEqual(readFileSync("__tests__/snapshots/text-report.txt", "utf8"));
});
