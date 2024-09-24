# Time Profiler

By default, ESBench only measure execution time of the benchmark cases, This is done by `TimeProfiler`, it can be configured by `timing` property of the suite:

```javascript
export default defineSuite({
	// ...
	timing: { /* options */ },
});
```

The default value is `true`, which equals to `{}`, setting `timing: false` disables `TimeProfiler`.

Type of the options:

```typescript
export interface TimingOptions {
	/**
	 * Measure throughput (ops/<unit>) instead of time (time/op). The value can be a duration unit.
	 *
	 * @example
	 * defineSuite({ timing: { throughput: "s" } });
	 * | No. |   Name |   throughput |
	 * | --: | -----: | -----------: |
	 * |   0 | object | 14.39M ops/s |
	 * |   1 |    map | 17.32M ops/s |
	 */
	throughput?: string;

	/**
	 * How many target iterations should be performed.
	 *
	 * @default 10
	 */
	samples?: number;

	/**
	 * How many warmup iterations should be performed. The value can be 0, which disables warmup.
	 *
	 * @default 5
	 */
	warmup?: number;

	/**
	 * how many times the benchmark method will be invoked per one iteration of a generated loop.
	 *
	 * @default 16
	 */
	unrollFactor?: number;

	/**
	 * Invocation count or time in a single iteration.
	 *
	 * If the value is a number it used as invocation count, must be a multiple of `unrollFactor`.
	 * It is a duration string, it used by Pilot stage to estimate the number of invocations per iteration.
	 *
	 * @default "1s"
	 */
	iterations?: number | string;

	/**
	 * Specifies if the overhead should be evaluated (Idle runs) and it's average value
	 * subtracted from every result. Very important for nano-benchmarks.
	 *
	 * @default true
	 */
	evaluateOverhead?: boolean;
}
```

The `iterations` can be a string in format `number`+`unit`, available units are `ns`, `us`, `ms`, `s`, `m`, `h`, `d`.

## Speed & Accuracy

For more reliable results, you should avoid doing other operations while running benchmarks. If a process occupies system resources while running a case, the running time for that use case may increase.

`TimeProfiler` uses a lot of calls to minimize variance, this will take longer, you can adjust some options to speed it up, **but be aware that this may reduce the precision of the results.**

* Smaller `iterations`: `100ms` is about 10x faster than `1s`, and use a number can skip the pilot stage.
* Turning down `sample` and `warnup` can also reduce the number of times a function is called.
* Set `evaluateOverhead` to `false` disables the overhead stage, which takes some time if the running time of the workload is close to the empty function.

Another solution for speed up benchmarking is [sharding with multiple machines](./cli#sharding).
