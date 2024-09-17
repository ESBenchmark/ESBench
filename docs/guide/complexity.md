# Complexity Profiler

ESBench supports calculate asymptotic complexity for a family of benchmarks. 

By set `complexity` options of the suite, you enables `ComplexityProfiler` which calculate the Big-O complexity of benchmark cases, it has builtin support for these types:

- `O(1)` Constant.
- `O(N)` Linear.
- `O(logN)` Logarithmic.
- `O(NlogN)` Linearithmic.
- `O(N^2)` Quadratic.
- `O(N^3)` Cubic.

If the possible values you predicted are not one of them, you can specify a customized set of curves with `complexity.curves`.

## Example

The following code will calculate the Big-O time of summation and binary search:

```javascript
import { defineSuite } from "esbench";

export default defineSuite({
    // To get complexity of the function, you must have a series of input.
	params: {
		length: [10, 50, 200, 520, 3000, 7500, 10_000],
	},
	complexity: {
		param: "length",    // Use `params.length` as input value.
		metric: "time",     // Metric name of the running time.
	},
	setup(scene) {
		const { length } = scene.params;
		const list = Array.from({ length }, (_, i) => i);

		scene.bench("Sum", () => {
			return list.reduce((s, v) => s + v);
		});
		scene.bench("Binary Search", () => {
			return binarySearch(list, Math.random() * length);
		});
	},
});

function binarySearch(arr, target) {
	let start = 0;
	let end = arr.length - 1;
	while (start <= end) {
		let middle = Math.floor((start + end) / 2);
		if (arr[middle] < target) {
			start = middle + 1;
		} else if (arr[middle] > target) {
			end = middle - 1;
		} else if (arr[middle] === target) {
			return middle;
		}
	}
}
```

The result:

```
| No. |          Name | length |        time |  time.SD | complexity |
| --: | ------------: | -----: | ----------: | -------: | ---------: |
|   0 |           Sum |     10 |     6.76 ns |  0.01 ns |       O(N) |
|   1 | Binary Search |     10 |    43.45 ns |  0.07 ns |    O(logN) |
|   2 |           Sum |     50 |    26.57 ns |  0.08 ns |       O(N) |
|   3 | Binary Search |     50 |    70.04 ns |  0.05 ns |    O(logN) |
|   4 |           Sum |    200 |   109.44 ns |  0.06 ns |       O(N) |
|   5 | Binary Search |    200 |    94.52 ns |  0.70 ns |    O(logN) |
|   6 |           Sum |    520 |   277.01 ns |  0.20 ns |       O(N) |
|   7 | Binary Search |    520 |   112.09 ns |  0.60 ns |    O(logN) |
|   8 |           Sum |   3000 | 1,576.53 ns |  1.37 ns |       O(N) |
|   9 | Binary Search |   3000 |   145.77 ns |  0.34 ns |    O(logN) |
|  10 |           Sum |   7500 | 3,932.22 ns |  4.77 ns |       O(N) |
|  11 | Binary Search |   7500 |   165.39 ns |  0.21 ns |    O(logN) |
|  12 |           Sum |  10000 | 5,279.12 ns | 11.12 ns |       O(N) |
|  13 | Binary Search |  10000 |   172.84 ns |  0.25 ns |    O(logN) |
```

Now we know that the time complexity of binary search is `O(logN)` and the summation is `O(N)`, the `N` is value of the parameter `length`.

Here's a [complete example](/playground?demo=es/complexity.js) with more functions.

## Options

`TimeProfiler` performs simple regression analysis on a variable and a metric, find the best fitting curve. The variable must be defined in `params`, and the metric should be provided by another profiler, in the above example, it uses the time provided by [TimeProfiler](./time-profiler).

- `param` Parameter name of the input size, the parameter must have at least 2 values, and all values must be finite number.

  **The more values the parameter has, the more accurate the results will be.** If the number is too small, it may not be able to match complex curves.
  
  Also notice that adding benchmark cases with conditional statements may lead to a reduction in sample size.

- `metric` Metric name of the case running time, type of the metric value must be `number` or `number[]`.

- `curves` (Optional) Using customized complexity curves, if set the builtin curves are ignored. example:

```javascript
// Detect cases is O(N^4) or O(loglogN).
new ComplexityProfiler({
    param: "length",
    metric: "time",
    curves: {
        "O(N^4)": n => n ** 4,
        "O(loglogN)": n => Math.log(Math.log(n)),
    }
})
```
