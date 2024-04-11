# Introduction

# Installation

```shell
pnpm add -D esbench
```

# Writing Benchmarks

As an example, we will write a simple benchmark suite that compare sum of numbers using for-loop and `Array.reduce`.

```javascript
// benchmark/example.js
import { defineSuite } from "esbench";

export default defineSuite({
	name: "Sum using for-loop vs Array.reduce",
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

By default, ESBench treat JS and TS files in the `<cwd>/benchmark` folder as benchmark suites, this behavior can be changed by the config file.

Next, in order to execute the benchmark, add the following section to your `package.json`:

```json
{
  "scripts": {
    "benchmark": "esbench"
  }
}
```

Finally, run `pnpm run benchmark`, and ESBench will print this message:

```text
Suite: Sum using for-loop vs Array.reduce
| No. |         Name |      time | time.SD |
| --: | -----------: | --------: | ------: |
|   0 |    For-index | 747.78 ns | 0.12 ns |
|   1 |       For-of | 749.24 ns | 0.13 ns |
|   2 | Array.reduce | 500.02 ns | 0.02 ns |
```
