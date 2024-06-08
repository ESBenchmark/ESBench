import { mkdtempSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { expect, it, vi } from "vitest";
import { resultStub, useTempDirectory } from "../helper.ts";
import { HostContext } from "../../src/host/context.ts";
import { textReporter } from "../../src/host/index.ts";

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

	await textReporter()({ perf: [resultStub] }, context);

	expect(output).toStrictEqual("[94mText reporter: Format benchmark results of 1 suites:[39m[92m[39m\n" +
		"[92mSuite: [39mperf\n" +
		"| No. | Name |        time |   time.SD |\n" +
		"| --: | ---: | ----------: | --------: |\n" +
		"|   0 |  foo |   750.00 us | 433.01 us |\n" +
		"|   1 |  bar | 1,750.00 us | 433.01 us |\n" +
		"\n");
});

it("should write to text file without color", async () => {
	const report = textReporter({ console: false, file });
	await report({ perf: [resultStub] }, context);

	const output = readFileSync(file, "utf8");
	expect(output).toStrictEqual(readFileSync("__tests__/snapshots/text-report.txt", "utf8"));
});
