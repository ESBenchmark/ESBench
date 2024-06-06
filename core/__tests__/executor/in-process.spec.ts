import { it } from "vitest";
import { executorTester } from "../helper.ts";
import inProcess from "../../src/executor/in-process.ts";

const tester = executorTester(inProcess);

it("should transfer messages", tester.successCase());

it("should forward errors from runAndSend()", tester.insideError());

it("should forward top level errors", tester.outsideError());
