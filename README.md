# ESBench

![NPM Version](https://img.shields.io/npm/v/esbench?style=flat-square)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ESBenchmark/ESBench/test.yml?style=flat-square)
![Codecov](https://img.shields.io/codecov/c/gh/ESBenchmark/ESBench?style=flat-square)

A modern JavaScript benchmarking tool.

- **Cross-runtime**: run your benchmark on Node, Bun, browsers, and more...
- **Parameterization**: provide a series of parameters and see the performance of each combination.
- **Comparable**: support baselines and diff with previous runs.
- **TypeScript Out-of-box**: load your `.ts` files with zero config.
- **HTML Reporter**: plot the results into an interactive chart.
- **Extensible**: support custom profiler, executor, and reporter.
- **IDE Integration**: run specific suite or case with a click of the mouse, support WebStorm and VSCode.

**For more details and getting started, visit [Document](https://esbench.vercel.app)**

# Simple Example

```javascript
// benchmark/example.js
import { defineSuite } from "esbench";

export default defineSuite({
    baseline: {
        type: "Name",
        value: "For-index",
    },
    params: {
        length: [10, 1000],
    },
    setup(scene) {
        const { length } = scene.params;
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

Run the suite:

```shell
pnpm add -D esbench
pnpm exec esbench
```

And see the report:

```text
Suite: example.js
| No. |         Name | length |      time | time.SD | time.ratio |
| --: | -----------: | -----: | --------: | ------: | ---------: |
|   0 |    For-index |     10 |   6.84 ns | 0.02 ns |      0.00% |
|   1 |       For-of |     10 |   8.73 ns | 0.30 ns |    +27.72% |
|   2 | Array.reduce |     10 |   4.34 ns | 0.02 ns |    -36.54% |
|     |              |        |           |         |            |
|   3 |    For-index |   1000 | 505.92 ns | 1.67 ns |      0.00% |
|   4 |       For-of |   1000 | 751.97 ns | 0.98 ns |    +48.63% |
|   5 | Array.reduce |   1000 | 500.30 ns | 0.16 ns |     -1.11% |
```
