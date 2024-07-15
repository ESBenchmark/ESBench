import { join } from "node:path/posix";
import { pathToFileURL } from "node:url";
import { pid } from "node:process";
import { Executor, SuiteTask } from "../host/toolchain.js";
import { highestPriority } from "./process.js";

/**
 * Run suites directly in the current context.
 */
export default <Executor>{

	name: "in-process",

	start() {
		highestPriority(pid);
	},

	async execute({ root, file, pattern, dispatch }: SuiteTask) {
		const url = pathToFileURL(join(root, "index.js"));
		const module = await import(url.href);
		return module.default(dispatch, file, pattern);
	},
};
