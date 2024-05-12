import { argv0 } from "process";
import { exec } from "child_process";
import { promisify } from "util";
import { buildCLI } from "@kaciras/utilities/node";
import { describe, expect, it } from "vitest";
import { compilers } from "../../src/host/loader.ts";

const execAsync = promisify(exec);

function runFixture(name: string) {
	const command = buildCLI(argv0, "--import", "./register.js", name);
	return execAsync(command, { cwd: "__tests__/fixtures/loader" });
}

it.each([
	"attribute.ts",
	"data-url.ts",
	"ts-file.ts",
	"ts-file.js",
	"ts-file.cjs",
	"ts-file.mjs",
])("should load: %s", name => {
	return expect(runFixture(name))
		.resolves
		.toHaveProperty("stdout", "Hello World");
});

const compilerWithNames = compilers.map(create => ({ name: create.name, create }));

describe.each(compilerWithNames)("$name", ({ create }) => {
	it("should compile TS", async () => {
		const sourceCode = "export default a ?? b as string";

		const compile = await create();
		const js = await compile(sourceCode, "script.ts");

		const b64 = js.slice(js.lastIndexOf(",") + 1);
		const sourceMap = JSON.parse(Buffer.from(b64, "base64").toString());
		expect(js).toContain("export default a ?? b;");
		expect(sourceMap.sources).toStrictEqual(["script.ts"]);
	});
});
