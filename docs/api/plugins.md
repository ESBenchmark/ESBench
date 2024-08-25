# Plugins

On the host side, ESBench builds suites, calls executors, and collects the results for reporting. Each step is accomplished by plugins.

**ESBench chose files as the bridge between the builder and the executor** because it is the most generalized model: all server-side runtimes are capable of running JS files, browser and remote execution are easily supported by setting up a simple file server.

## Builder

When ESBench starts, it first builds suites for benchmark with builders. A builder is an object contain 2 properties: `name` specifies the default name, and `build()` method generates the output.

```typescript
export interface Builder {
	/**
	 * Suggest a name for the builder, it will be used if no name specified from config.
	 */
	name: string;
	/**
	 * Transform the files needed for the benchmark.
	 *
	 * @param outDir The directory in which all generated chunks should be placed.
	 * @param files Import specifiers of suites relative to cwd.
	 */
	build(outDir: string, files: string[]): Awaitable<void>;
}
```

The responsibilities of the builder are:

* handle imports so that the target platform can load modules (e.g. bundle modules from `node_modules` for browsers).
* converting code that is not supported by the target platform (e.g. TS -> JS)

### Inputs

A builder instance will only be called once. Each item of the toolchain in the configuration matches a number of files that will be added to the files list of all builders for that item at build time and passed to `encode` function.

For example, with this config, the `files` argument of `myBuilder` will include:

- Files matches glob patterns `./foo/*.[jt]s` and `./bar/*.js`.
- Files matches the pattern `./baz/*.js` but not match `./**/utils-*.js`.

```javascript
const myBuilder = {
	name: "mybuilder",
	encode(outDir, files) { /* ... */ },
};

export default defineConfig({
	toolchains: [{
		include: ["./foo/*.[jt]s", "./bar/*.js"],
		builders: [myBuilder],
	}, {
		include: ["./baz/*.js"],
		exclude: ["./**/utils-*.js"],
		builders: [myBuilder],
	}],
});
```

ESBench enforces the convention that the output of a build must contain a file named `<outDir>/index.js`, which will be used by executors, and it should have a default export of the function:

```typescript
/**
 * The entry file that build output needs to export a function that match the signature.
 *
 * This function needs to call `runAndSend` and provide the import module function.
 */
type EntryExport = (postMessage: Channel, files: string[], pattern?: string) => Promise<void>;
```


### Implementation

A example of integrate ESBench with [Rolldown](https://github.com/rolldown/rolldown).

1. Create an entry module that contains imports of all suites, so that Rolldown can resolve them.
2. Call `rolldown` to start the build process.
3. Write files to `outDir`, the entry filename must be `index.js`.

```typescript
import { writeFileSync } from "node:fs";
import { Builder, defineConfig, WebRemoteExecutor } from "esbench/host";
import { Plugin, rolldown } from 'rolldown';

class RolldownBuilder implements Builder {

	name = "rolldown"

	async build(outDir: string, files: string[]) {
		// A better approach is use a plugin to create it from string.
		const imports = files.map(s => `"${s}":()=>import("${s}")`).join()
		writeFileSync("temp-entry.js", `\
			import { runAndSend } from "esbench";
			
			const suites = {${imports}\n};
			const doImport = file => suites[file]();
			
			export default function (post, file, pattern) {
				return runAndSend(post, doImport, file, pattern);
			}`
		);

		// Build and write output to `outDir`.
		const build = await rolldown({
			input: {
				index: "temp-entry.js",
			},
			resolve: {
				conditionNames: ['import'],
			},
		});
		await build.write({
			dir: outDir,
			chunkFileNames: "[name].js", // The entry file must be "index.js"
		})
	}
}
```
