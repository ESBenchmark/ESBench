# Executor

After the build is done, we have the files to run, the next step is to execute them, ESBench delegates this work to executors.

An executor has to do roughly these jobs:

* Do prepare step if needed.
* Call `index.js` of builder output, and pass the arguments.
* Transmits messages generated during running the suite.

## A Simple Executor

The simplest implementation is executing the suite directly:

```typescript
import { pathToFileURL } from "node:url";
import { join } from "node:path/posix";
import { Executor, SuiteTask } from "esbench/host";

export default <Executor>{
	/**
	 * Suggest a name will be used if no name specified from config.
	 */
	name: "direct",

	/**
     * Execute a suite, this method will be called for each suite of each build.
     * 
	 * @param root Output directory of the build, can be used to resolve imports.
	 * @param file Path (relative to cwd) of the suite file to run.
	 * @param pattern Run benchmark with names matching the Regex pattern.
	 * @param dispatch Executor should forward messages to this function.
	 */
	async execute({ root, file, pattern, dispatch }: SuiteTask) {
		// Import the build output.
		const url = pathToFileURL(join(root, "index.js"));
		const module = await import(url.href);
		
		// Call the default export, `file` and `pattern` are usually forwarded directly
		return module.default(dispatch, file, pattern);
	},
};
```

## Call External Runtime

When you want to run benchmarks in different processes, you need to deal with the passing of parameters and messages. Commonly, you can create an entry module and load the build output through it.

```typescript
import { defineConfig, Executor, HostContext, SuiteTask } from "esbench/host";
import { createServer, Server } from "node:http";
import { json } from "node:stream/consumers";
import { once } from "node:events";
import { relative } from "node:path";
import { join } from "node:path/posix";
import { writeFileSync } from "node:fs";
import { execFile, ChildProcess } from "node:child_process";

class SimpleProcessExecutor implements Executor {

	name = "demo-process"

	private tempDir!: string;
	private server!: Server;
	private task!: SuiteTask;
	private process?: ChildProcess;

	// `start` method is called once before the executor starts executing.
	// We setup a HTTP server to receive messages.
	start(host: HostContext) {
		this.tempDir = host.config.tempDir;
		this.server = createServer((request, response) => {
			response.end();
			// Executor should forward messages to `SuiteTask.dispatch`
			return json(request).then(this.task.dispatch);
		});
		this.server.listen(80);
		return once(this.server, "listening");
	}

	// When no more suites need to be executed, `close` method will be called.
	close() {
		if (this.process?.pid) {
			this.process.kill();
		}
		this.server.close();
	}

	execute(task: SuiteTask) {
		this.task = task;

		// Kill previous not exited process.
		this.process?.kill();

		// Get relative path of index.js of builder output.
		const indexJs = relative(this.tempDir, join(task.root, "index.js")).replaceAll("\\", "/");

		// Since the result of the build is not complete, we also need to
		// provide a way to transfer messages, so we create an entry module.
		const entry = join(this.tempDir, "main.js");
		writeFileSync(entry, `\
			// Import the build output.
			import runAndSend from "./${indexJs}";

			// Send message to our HTTP server.
			const post = message => fetch("http://localhost", {
				method: "POST",
				body: JSON.stringify(message),
			});
			
			// Run the suite!
			runAndSend(post, "${task.file}", "${task.pattern}");
		`);

		// Call JS runtime to run the entry file.
		this.process = execFile("node", [entry]);

		// Check exit code, call `SuiteTask.reject` tells ESBench the execution failed.
		this.process.on("exit", code => {
			if (code !== 0) {
				task.reject(new Error(`Execute Failed (${code})`));
			}
		});
	}
}
```
