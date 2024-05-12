import { argv0 } from "process";
import { exec } from "child_process";
import { promisify } from "util";
import { buildCLI } from "@kaciras/utilities/node";
import { expect, it } from "vitest";

const execAsync = promisify(exec);

function runFixture(name: string) {
	const command = buildCLI(argv0, "--import", "./register.js", name);
	return execAsync(command, { cwd: "__tests__/fixtures/loader" });
}

it("should transform TS files", async () => {
	return expect(runFixture("ts-file.ts")).resolves.toHaveProperty("stdout", "Hello World");
});

it("should lookup TS original for JS files",  () => {
	return expect(runFixture("ts-file.js")).resolves.toHaveProperty("stdout", "Hello World");
});

it("should not affect `data:` import",  () => {
	return expect(runFixture("data-url.ts")).resolves.toHaveProperty("stdout", "Hello World");
});
