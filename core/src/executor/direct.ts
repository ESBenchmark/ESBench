import { release } from "process";
import { join } from "path/posix";
import { pathToFileURL } from "url";
import { ExecuteOptions, Executor } from "../host/toolchain.js";

/**
 * Run suites directly in the current context.
 */
export default <Executor>{

	name: release.name,

	async execute({ root, files, pattern, dispatch }: ExecuteOptions) {
		const url = pathToFileURL(join(root, "index.js"));
		const module = await import(url.toString());
		return module.default(dispatch, files, pattern);
	},
};