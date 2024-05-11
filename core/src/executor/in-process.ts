import { pid } from "process";
import { join } from "path/posix";
import { pathToFileURL } from "url";
import { ExecuteOptions, Executor } from "../host/toolchain.js";
import { highestPriority } from "./process.js";

/**
 * Run suites directly in the current context.
 */
export default <Executor>{

	name: "in-process",

	start() {
		highestPriority(pid);
	},

	async execute({ root, files, pattern, dispatch }: ExecuteOptions) {
		const url = pathToFileURL(join(root, "index.js"));
		const module = await import(url.toString());
		return module.default(dispatch, files, pattern);
	},
};
