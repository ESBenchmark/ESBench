import { expect, it } from "vitest";
import NodeExecutor from "../../src/executor/node.js";
import { executorTester } from "../helper.ts";

const tester = executorTester(new NodeExecutor());

it("should have a name", () => {
	expect(new NodeExecutor()).toHaveProperty("name", "node");
});

it("should transfer messages", tester.successCase());

it("should forward errors from runAndSend()", tester.insideError());

it("should forward top level errors", tester.outsideError("Node execute Failed (1), args=[]"));
