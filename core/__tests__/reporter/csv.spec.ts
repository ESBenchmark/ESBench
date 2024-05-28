import { mkdtempSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { expect, it } from "vitest";
import { createLogger } from "../../src/host/logger.ts";
import csvReporter from "../../src/reporter/csv.ts";
import { useTempDirectory } from "../helper.ts";
import { MetricAnalysis, MetricMeta, ToolchainResult } from "../../src/index.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
useTempDirectory(directory);

const report = csvReporter({ directory });
const logger = createLogger("off");

const time: MetricMeta = {
	key: "time",
	format: "{duration.ms}",
	analysis: MetricAnalysis.Statistics,
	lowerIsBetter: true,
};

const defaultResult = {
	name: "test",
	notes: [],
	paramDef: [],
	meta: { time },
};

const result: ToolchainResult[] = [{
	...defaultResult,
	scenes: [{
		"case,1": { time: [0, 1, 1, 1] },
		"case,2": { time: [1, 2, 2, 2] },
	}],
}];

it("should works", async () => {
	await report({ perf: result }, {}, logger);
	const expected = [
		"No.,Name,time,time.SD",
		'0,"case,1",0.75,0.4330127018922193',
		'1,"case,2",1.75,0.4330127018922193',
	];
	const csv = expected.join("\r\n") + "\r\n";

	const files = readdirSync(directory, { recursive: true }) as string[];
	expect(files).toStrictEqual(["perf.csv"]);
	expect(readFileSync(join(directory, files[0]), "utf8")).toBe(csv);
});
