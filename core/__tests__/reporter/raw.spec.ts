import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { resultStub, useTempDirectory } from "../helper.ts";
import rawReporter from "../../src/reporter/raw.ts";
import { HostContext } from "../../src/host/context.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
useTempDirectory(directory);

const report = rawReporter(join(directory, "[date]_[time].json"));
const context = new HostContext({ logLevel: "off" });

it("should add time to file name", async () => {
	const results = { perf: [resultStub] };
	await report(results, context);
	const files = readdirSync(directory, { recursive: true });

	const content = readFileSync(join(directory, files[0] as string), "utf8");
	expect(files).toHaveLength(1);
	expect(JSON.parse(content)).toStrictEqual(results);
	expect(files[0]).toMatch(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json/);
});
