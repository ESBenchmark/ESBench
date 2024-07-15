import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import reporter from "../../src/reporter/html.ts";
import { resultStub } from "../helper.ts";
import { HostContext } from "../../src/host/index.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
const filename = `${directory}/report.html`;
const context = new HostContext({ logLevel: "off" });

it("should works", async () => {
	const report = reporter(filename);
	await report({ perf: [resultStub] },  context);

	const html = readFileSync(filename, "utf8");
	expect(html).toContain("<script>window.Result={");
});
