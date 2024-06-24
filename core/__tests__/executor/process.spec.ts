import { describe, expect, it } from "vitest";
import { executorTester } from "../helper.ts";
import ProcessExecutor from "../../src/executor/process.ts";

const tester = executorTester(new ProcessExecutor("node"));

it("should transfer messages", tester.successCase());

it("should forward errors from runAndSend()", tester.insideError());

it("should forward top level errors", tester.outsideError(
	"Execute Failed (1), Command: node .esbench-tmp/main.js",
));

it("should suggest the filename as executor name", () => {
	const command = '"/path/to/mock app.sh" -foo --bar';
	expect(new ProcessExecutor(command).name).toBe("mock app.sh");
});

describe("Custom command line", () => {
	const instance = new ProcessExecutor(f => `node --expose_gc ${f} "foo bar"`, { BAZ: "qux" });
	const tester = executorTester(instance);

	it("should forward top level errors", tester.outsideError(
		'Execute Failed (1), Command: node --expose_gc .esbench-tmp/main.js "foo bar"',
	));

	it("should pass arguments and env vars", async () => {
		const dispatch = await tester.execute("inspect");
		const [message] = dispatch.mock.calls[0] as any;
		expect(message.argv.slice(2)).toStrictEqual(["foo bar"]);
		expect(message.env).toHaveProperty("BAZ", "qux");
		expect(message.env).toHaveProperty("NODE_ENV", "test");
		expect(message.execArgv).toStrictEqual(["--expose_gc"]);
	});
});
