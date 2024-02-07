import { release } from "process";
import { join } from "path/posix";
import { pathToFileURL } from "url";
import { Executor, RunOptions } from "../host/toolchain.js";

/**
 * Run suites directly in the current context.
 */
export default class DirectExecutor implements Executor {

	get name() {
		return release.name;
	}

	async run({ root, files, pattern, handleMessage }: RunOptions) {
		const url = pathToFileURL(join(root, "index.js"));
		const module = await import(url.toString());
		return module.default(handleMessage, files, pattern);
	}
}
