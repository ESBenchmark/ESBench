import tp from "timers/promises";
import { CPSrcObject, noop } from "@kaciras/utilities/browser";
import { BenchmarkSuite, runSuite } from "../src/index.js";

export const sleep1 = tp.setTimeout.bind(null, 1);

export function run<T extends CPSrcObject>(suite: Partial<BenchmarkSuite<T>>, pattern?: RegExp) {
	suite.name ??= "Test Suite";
	suite.timing = {
		iterations: 1,
		samples: 1,
		warmup: 0,
		unrollFactor: 1,
		...(suite.timing as any),
	};
	return runSuite(suite as any, { log: noop, pattern });
}
