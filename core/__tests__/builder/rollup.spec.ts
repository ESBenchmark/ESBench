import { mkdtempSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { pathToFileURL } from "url";
import { expect, it, vi } from "vitest";
import { RollupBuilder, ViteBuilder } from "../../src/builder/rollup.ts";
import { Builder } from "../../src/host/index.ts";

const directory = mkdtempSync(join(tmpdir(), "esbench-"));

async function testBundle(builder: Builder) {
	const files = ["./__tests__/fixtures/empty-suite.js"];
	await builder.build(directory, files);

	const url = pathToFileURL(join(directory, "index.js"));
	const module = await import(url.toString());

	const postMessage = vi.fn();
	await module.default(postMessage, files);

	const results = postMessage.mock.calls.at(-1)[0];
	expect(results[0].meta.foobar).toBeDefined();

	return [readFileSync(url, "utf8"), module];
}

it("should generate loader entry with Rollup", () => {
	return testBundle(new RollupBuilder());
});

it("should generate loader entry with Vite", async () => {
	const [code] = await testBundle(new ViteBuilder());
	expect(code).not.toContain("__vitePreload");
});
