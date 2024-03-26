# ESBench

Full-featured JavaScript benchmarking tool.

* Cross-runtime: run your benchmark on Node, Bun, browsers, and more...
* Parameterization: provide a series of parameters and see the performance of each combination.
* HTML Reporter: plot the results in an interactive chart.
* Comparable: support baseline and diff with previous runs.
* IDE Integration: run specific suite or case with a click of the mouse, support WebStorm and VSCode.

For more details and getting started, visit [DOC](TODO)

# Simple Example

```javascript
// benchmark/example.js
import { defineSuite } from "esbench";

export default defineSuite({
    name: "Sum using for-loop vs Array.reduce",
    baseline: {
        type: "Name",
        value: "For-index",
    },
    params: {
        size: [10, 1000],
    },
    setup(scene) {
        const { size } = scene.params;
        const values = [];
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

Run the suite:

```shell
pnpm install esbench
pnpm exec esbench
```

And see the report:

```text
Suite: Sum using for-loop vs Array.reduce
| No. |         Name | size |      time | time.ratio |
| --: | -----------: | ---: | --------: | ---------: |
|   0 |    For-index |   10 | 118.13 ns |      0.00% |
|   1 |       For-of |   10 | 500.15 ns |   +323.40% |
|   2 | Array.reduce |   10 |  63.95 ns |    -45.86% |
|     |              |      |           |            |
|   3 |    For-index | 1000 |  11.81 us |      0.00% |
|   4 |       For-of | 1000 |  46.85 us |   +296.85% |
|   5 | Array.reduce | 1000 |  11.58 us |     -1.90% |
```
