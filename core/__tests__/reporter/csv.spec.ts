import { mkdtempSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { expect, it } from "vitest";
import { HostContext } from "../../src/host/context.ts";
import csvReporter from "../../src/reporter/csv.ts";
import { resultStub, useTempDirectory } from "../helper.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
useTempDirectory(directory);

const report = csvReporter({ directory });
const context = new HostContext({ logLevel: "off" });

function assertCSVFile(name: string, rows: string[]) {
	const csv = rows.join("\r\n") + "\r\n";
	expect(readFileSync(join(directory, name), "utf8")).toBe(csv);
}

it("should works", async () => {
	await report({ perf: [resultStub] }, context);

	assertCSVFile("perf.csv", [
		"No.,Name,time,time.SD",
		"0,foo,0.75,0.4330127018922193",
		"1,bar,1.75,0.4330127018922193",
	]);
	expect(readdirSync(directory, { recursive: true })).toStrictEqual(["perf.csv"]);
});

it("should escape special characters", async () => {
	const results = [{
		...resultStub,
		meta: {
			text: { key: "text" },
		},
		scenes: [{
			"case, 1 ": { text: "a\nb" },
			'case-"2"': { text: [114514] },
		}],
	}];
	await report({ perf: results }, context);
	assertCSVFile("perf.csv", [
		"No.,Name,text",
		'0,"case, 1 ","a\nb"',
		'1,"case-""2""",114514',
	]);
});

it("should write empty for undefined ", async () => {
	const results = [{
		...resultStub,
		scenes: [{
			foo: {},
			bar: { time: [1, 2, 2, 2] },
		}],
	}];
	await report({ perf: results }, context);
	assertCSVFile("perf.csv", [
		"No.,Name,time,time.SD",
		"0,foo,,",
		"1,bar,1.75,0.4330127018922193",
	]);
});
