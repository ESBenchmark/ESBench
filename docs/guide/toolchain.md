ESBench is a cross runtime benchmark tool, which means you can run your suite on different runtime.

Following example runs 

```shell
pnpm install vite playwright
```



```javascript
// esbench.config.js
import { defineConfig, PlaywrightExecutor, ViteBuilder } from "@esbench/core";
import { chromium, firefox, webkit } from "playwright";

export default defineConfig({
	toolchains: [{
		builders: [new ViteBuilder()],
		executors: [
			new PlaywrightExecutor(firefox),
			new PlaywrightExecutor(webkit),
			new PlaywrightExecutor(chromium),
		],
	}],
});
```

And our suite file `benchmark/array-sum.js` contains the code:

```javascript
import { defineSuite } from "@esbench/core/client";

export default defineSuite({
	name: "For-loop vs Array.reduce",
	params: {
		size: [0, 100, 10000],
	},
	setup(scene) {
		const { size } = scene.params;
		const values = new Array(size);
		for (let i = 0; i < size; i++) {
			values.push(Math.random());
		}

		scene.bench("For-index", () => {
			let sum = 0;
			for (let i = 0; i < size; i++) sum += values[i];
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
