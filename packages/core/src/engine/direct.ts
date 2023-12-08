import { execArgv, version } from "process";
import { join } from "path/posix";
import { pathToFileURL } from "url";
import { Engine, RunOptions } from "../stage.js";

/**
 * Run suites directly in the current context.
 */
export default class DirectEngine implements Engine {

	start() {
		return execArgv.length
			? `NodeJS ${version} (${execArgv.join(" ")})`
			: `NodeJS ${version}`;
	}

	close() {}

	async run({ root, files, pattern, handleMessage }: RunOptions) {
		const url = pathToFileURL(join(root, "index.js"));
		const module = await import(url.toString());
		return module.default(handleMessage, files, pattern);
	}
}
