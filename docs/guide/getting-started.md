# Getting Started

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
ESBench CLI requires Node >= 18.19.0
:::

## Writing Benchmarks

Compare the time for sum of numbers using for-loop and `Array.reduce`:

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

ESBench can run multiple suites at once. By default, files match the [micromatch](https://github.com/micromatch/micromatch) pattern `benchmark/**/*.[jt]s?(x)` in CWD are treated as benchmark suites, this behavior can be changed by the [config](./config).

Next, in order to execute the benchmark, add the following section to your `package.json`:

```json
{
  "scripts": {
    "benchmark": "esbench"
  }
}
```

> [!INFO]
> To support execution in different runtimes, ESBench needs to use the CLI instead of running the suite file directly.
>
> If you prefer to work with a GUI, we also provide [IDE plugin](./ide-integration).
> 
> For integration with ESBench in your code, see [JavaScript API](../api/runner-api).

Finally, run `pnpm run benchmark` or `pnpm exec esbench` to execute the suite.

> [!TIP]
> The `esbench` command runs all matching suites by default, if you want to run a particular file, you can use the `--file <filename>` argument. (e.g. `esbench --file array-sum.js`)

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

You can find more examples at [ESBench repository](https://github.com/ESBenchmark/ESBench/tree/master/example)
