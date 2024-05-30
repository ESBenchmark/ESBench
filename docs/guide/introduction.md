# Introduction

ESBench is a modern JavaScript benchmarking tool.

- **Cross-runtime**: run your benchmark on Node, Bun, browsers, and more...
- **Parameterization**: provide a series of parameters and see the performance of each combination.
- **Comparable**: support baselines and diff with previous runs.
- **TypeScript Out-of-box**: load your `.ts` files with zero config.
- **HTML Reporter**: plot the results into an interactive chart.
- **IDE Integration**: run specific suite or case with a click of the mouse, support WebStorm and VSCode.

## Why ESBench

### Benchmark JS Runtimes

One difference between JavaScript and other languages is that it has no official interpreter. Browsers, Node, and the new Deno and bun are all possible target platforms, and the performance of the code on different platforms is a worthwhile question.

ESBench aims to run your benchmarks on different runtimes and let you know comprehensive and reliable results.

## Installation

::: code-group
```bash [npm]
npm install -D esbench
```
```bash [yarn]
yarn add -D esbench
```
```bash [pnpm]
pnpm add -D esbench
```
:::

:::tip
ESBench requires Node >= 18.19.0
:::

## Writing Benchmarks

For example, we will write a simple benchmark suite that compares the time it takes to calculate the sum of numbers using for-loop and `Array.reduce`.

```javascript
// benchmark/array-sum.js
import { defineSuite } from "esbench";

export default defineSuite(scene => {
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
		return values.reduce((v, s) => s + v);
	});
});
```

By default, files match the [micromatch](https://github.com/micromatch/micromatch) pattern `benchmark/**/*.[jt]s?(x)` in CWD are treated as benchmark suites, this behavior can be changed by the [config file](./config).

Next, in order to execute the benchmark, add the following section to your `package.json`:

```json
{
  "scripts": {
    "benchmark": "esbench"
  }
}
```

> [!TIP]
> To support execution of the suite in different runtimes, ESBench needs to use the CLI instead of running the suite file directly.
>
> For integration with ESBench, we also provide [JavaScript API](../api/runner).

Finally, run `pnpm run benchmark` to execute the suite.

The run will take a while for accurate measurements, during which a lot of logs will be printed. After finishing it will output:

```text
| No. |         Name |      time | time.SD |
| --: | -----------: | --------: | ------: |
|   0 |    For-index | 502.34 ns | 0.88 ns |
|   1 |       For-of | 751.25 ns | 0.84 ns |
|   2 | Array.reduce | 500.36 ns | 0.34 ns |
```

> [!NOTE]
> `time.SD` is Standard Deviation of the time.
