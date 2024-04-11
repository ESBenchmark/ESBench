# Toolchains

ESBench is a cross runtime benchmark tool, which means you can run your suite on different runtime.

---

Following example runs the suite on Firefox, Webkit, and Chromium using [Playwright](https://playwright.dev).

First you need to install playwright and a builder. The builder is needed because browser and Node have a different import resolving algorithm, and ESBench does not handle that, so suites need to be built to transform imports.

```shell
pnpm add -D playwright vite
```

```javascript
// esbench.config.js
import { defineConfig, PlaywrightExecutor, ViteBuilder } from "esbench/host";
import { chromium, firefox, webkit } from "playwright";

export default defineConfig({
	toolchains: [{
		builders: [new ViteBuilder()],
		executors: [
			new PlaywrightExecutor(firefox, { headless: false }),
			new PlaywrightExecutor(webkit, { headless: false }),
			new PlaywrightExecutor(chromium, { headless: false }),
		],
	}],
});
```

And our suite file `benchmark/loop-reduce.js` contains the code:

```javascript
import { defineSuite } from "esbench";

export default defineSuite({
	name: "For-loop vs Array.reduce",
	setup(scene) {
		const length = 1000;
		const values = Array.from({ length }, (_, i) => i);

		scene.bench("For-index", () => {
			let sum = 0;
			for (let i = 0; i < length; i++) sum += values[i];
			return sum;
		});

		scene.bench("For-of", () => {
			let sum = 0;
			for (const v of values) sum += v;
			return sum;
		});

		scene.bench("Array.reduce", () => {
			return values.reduce((v, s) => s + v, 0);
		});
	},
});
```

Run `esbench` pop up the browser window 3 times, and the suite is executed on a blank page. Remove `headless: false` from the config then browsers will run in background.

The results reveal the performance differences between browsers:

```text
| No. |         Name | Executor |        time |  time.SD |
| --: | -----------: | -------: | ----------: | -------: |
|   0 |    For-index |  firefox |   521.91 ns |  0.73 ns |
|   1 |       For-of |  firefox | 5,494.97 ns |  2.02 ns |
|   2 | Array.reduce |  firefox | 3,882.88 ns | 15.65 ns |
|   3 |    For-index |   webkit | 1,015.20 ns |  1.39 ns |
|   4 |       For-of |   webkit | 2,580.47 ns | 32.06 ns |
|   5 | Array.reduce |   webkit | 2,497.12 ns |  8.69 ns |
|   6 |    For-index | chromium |   764.32 ns |  0.85 ns |
|   7 |       For-of | chromium |   516.50 ns |  3.74 ns |
|   8 | Array.reduce | chromium |   351.31 ns |  0.85 ns |
```

# Builtin Tools

ESBench provide some builders and executors out of box.

Builder:

* `noBuild` Does not perform any transformation, this is the default builder.
* `ViteBuilder` Build suites with [Vite](https://vitejs.dev), requires Vite installed.
* `RollupBuilder` Build suites with [Rollup](https://rollupjs.org/), requires Rollup installed.

Executor:

* `directExecutor` Run suites directly in the current context, this is the default executor.
* `ProcessExecutor` Call an external JS runtime to run suites, the runtime must support the fetch API.
* `NodeExecutor` Spawn a new Node process to run suites, can be used with legacy Node that does not have `fetch`.
* `PlaywrightExecutor` Run suites in the browser.
* `WebextExecutor` Run suites in the browser with [WebExtension API](https://developer.chrome.com/docs/extensions/reference/api) access. Currently only support Chromium.

# Tool Names

Each tool must have a unique name (a builder and an executor can have the same name).
