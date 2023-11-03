import { execArgv, version } from "process";
import { join } from "path/posix";
import { pathToFileURL } from "url";
import { BenchmarkEngine, RunOptions } from "../stage.js";

/**
 * Run suites directly in the current context.
 */
export default class DirectEngine implements BenchmarkEngine {

	start() {
		return execArgv.length
			? `NodeJS ${version} (${execArgv.join(" ")})`
			: `NodeJS ${version}`;
	}

	close() {}

	async run({ root, entry, files, pattern, handleMessage }: RunOptions) {
		const url = pathToFileURL(join(root, entry));
		const module = await import(url.toString());
		return module.default(handleMessage, files, pattern);
	}
}
