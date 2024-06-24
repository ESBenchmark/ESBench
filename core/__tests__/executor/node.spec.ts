import { expect, it } from "vitest";
import NodeExecutor from "../../src/executor/node.js";
import { executorTester } from "../helper.ts";

const tester = executorTester(new NodeExecutor({
	env: { BAZ: "qux" },
	execArgv: ["--expose_gc"],
}));

it("should have a name", () => {
	expect(new NodeExecutor()).toHaveProperty("name", "node");
});

it("should transfer messages", tester.successCase());

it("should forward errors from runAndSend()", tester.insideError());

it("should forward top level errors", tester.outsideError('Node execute Failed (1), execArgv=["--expose_gc"]'));

it("should pass arguments and env vars", async () => {
	const dispatch = await tester.execute({
		file: "./foo.js",
		root: "__tests__/fixtures/inspect",
	});
	const [message] = dispatch.mock.calls[0] as any;
	expect(message.env).toHaveProperty("BAZ", "qux");
	expect(message.env).toHaveProperty("NODE_ENV", "test");
	expect(message.execArgv).toStrictEqual(["--expose_gc"]);
});
