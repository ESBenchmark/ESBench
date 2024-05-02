# Custom Profilers

ESBench only has built-in support for measuring function execution time, but the term benchmarking isn't the only one, the size of the returned value or other metrics may also be something we want to know.

For that, ESBench allow to add custom profilers to suite, whose measured metrics will be displayed in the report.

For example, measure execution time and result size of compress functions in `zlib`: 

```javascript
import { readFileSync } from "fs";
import { brotliCompressSync, deflateSync, gzipSync } from "zlib";
import { defineSuite, MetricAnalysis } from "esbench";

const data = readFileSync("../pnpm-lock.yaml");

const dataSizeProfiler = {
	// In onStart hook, we define a size metric.
	onStart(ctx) {
		ctx.defineMetric({
            // The value should be stored in `metrics.size`
			key: "size",
            // How to format the metric into string.
			format: "{dataSize}",
            // The value is comparable, so `*.ratio` and `*.diff` columns can be drived from it.
			analysis: MetricAnalysis.Compare,
            // For compression algorithms, the smaller the result the better.
			lowerIsBetter: true,
		});
	},
    // This hook is run once per benchmark case.
    // Use `BenchCase.invoke` to call the workload function.
	async onCase(ctx, case_, metrics) {
		metrics.size = (await case_.invoke()).length;
	},
};

export default defineSuite({
    // Add the profiler to the suite.
	profilers: [dataSizeProfiler],
	baseline: {
		type: "Name",
		value: "deflate",
	},
	setup(scene) {
		scene.bench("deflate", () => deflateSync(data));
		scene.bench("gzip", () => gzipSync(data));
		scene.bench("brotli", () => brotliCompressSync(data));
	},
});
```

Output:

```text
| No. |    Name |      size | size.ratio |      time |  time.SD | time.ratio |
| --: | ------: | --------: | ---------: | --------: | -------: | ---------: |
|   0 | deflate | 38.02 KiB |      0.00% |   1.60 ms |  3.06 us |      0.00% |
|   1 |    gzip | 38.04 KiB |     +0.03% |   1.62 ms |  4.77 us |     +1.56% |
|   2 |  brotli | 34.45 KiB |     -9.40% | 110.01 ms | 23.32 us |  +6794.70% |
```
