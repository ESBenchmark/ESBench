import { describe, expect, it } from "vitest";
import { executorTester } from "../helper.ts";
import ProcessExecutor from "../../src/executor/process.ts";

const tester = executorTester(new ProcessExecutor("node"));

it("should transfer messages", tester.successCase());

it("should forward errors from runAndSend()", tester.insideError());

it("should forward top level errors", tester.outsideError(
	"Execute Failed (1), Command: node .esbench-test-temp/main.js",
));

it("should suggest the filename as executor name", () => {
	const command = '"/path/to/mock app.sh" -foo --bar';
	expect(new ProcessExecutor(command).name).toBe("mock app.sh");
});

describe("Custom command line", () => {
	const tester = executorTester(new ProcessExecutor(f => `node --expose_gc ${f} "foo bar"`));

	it("should forward top level errors", tester.outsideError(
		'Execute Failed (1), Command: node --expose_gc .esbench-test-temp/main.js "foo bar"',
	));
});
