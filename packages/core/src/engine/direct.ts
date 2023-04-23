import { execArgv, version } from "process";
import { join } from "path/posix";
import { pathToFileURL } from "url";
import { BenchmarkEngine, RunOptions } from "../host.js";

export default class DirectEngine implements BenchmarkEngine {

	start() {
		return execArgv.length
			? `NodeJS ${version} (${execArgv.join(" ")})`
			: `NodeJS ${version}`;
	}

	close() {}

	async run({ root, entry, files, task, handleMessage }: RunOptions) {
		const url = pathToFileURL(join(root, entry));
		const module = await import(url.toString());
		return module.default(handleMessage, files, task);
	}
}
