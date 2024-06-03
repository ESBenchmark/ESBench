import { mkdtempSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { expect, it } from "vitest";
import { resultStub, useTempDirectory } from "../helper.ts";
import rawReporter from "../../src/reporter/raw.ts";
import { createLogger } from "../../src/host/logger.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
useTempDirectory(directory);

const report = rawReporter(join(directory, "[date]_[time].json"));
const logger = createLogger("off");

it("should add time to file name", async () => {
	const results ={ perf: [resultStub] };
	await report(results, {}, logger);
	const files = readdirSync(directory, { recursive: true });

	const content = readFileSync(join(directory, files[0] as string),"utf8");
	expect(files).toHaveLength(1);
	expect(JSON.parse(content)).toStrictEqual(results);
	expect(files[0]).toMatch(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json/);
});
