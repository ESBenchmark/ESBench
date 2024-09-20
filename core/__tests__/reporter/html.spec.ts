import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { expect, it, vi } from "vitest";
import openBrowser from "open";
import reporter from "../../src/reporter/html.ts";
import { resultStub } from "../helper.ts";
import { HostContext } from "../../src/host/index.ts";

vi.mock("open");

const directory = mkdtempSync(join(tmpdir(), "esbench-"));
const filename = `${directory}/report.html`;
const context = new HostContext({ logLevel: "off" });

it("should create the report HTML", async () => {
	const report = reporter(filename);
	await report({ perf: [resultStub] },  context);

	const html = readFileSync(filename, "utf8");
	expect(html).toContain("<script>window.Result={");
});

it("should open the page automatically",async () => {
	const url = pathToFileURL(filename).href;
	const openConfig = {};
	const report = reporter(filename, openConfig);

	await report({ perf: [resultStub] },  context);

	expect(openBrowser).toHaveBeenCalledWith(url, openConfig);
});
