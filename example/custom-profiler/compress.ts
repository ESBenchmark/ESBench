import { readFileSync } from "fs";
import { brotliCompressSync, brotliDecompressSync, deflateSync, gzipSync, inflateSync, unzipSync } from "zlib";
import { defineSuite, ExecutionTimeMeasurement, MetricAnalysis, Profiler } from "esbench";

const data = readFileSync("../pnpm-lock.yaml");

const dataSizeProfiler: Profiler = {
	// In onStart hook, we define a size metric.
	onStart: ctx => ctx.defineMetric({
		// The value should be stored in `metrics.size`
		key: "size",
		// How to format the metric into string.
		format: "{dataSize}",
		// The value is comparable, so `*.ratio` and `*.diff` columns can be derived from it.
		analysis: MetricAnalysis.Compare,
		// For compression algorithms, the smaller the result the better.
		lowerIsBetter: true,
	}),
	/*
	 * This hook is run once per benchmark case, you can add values to metrics.
	 * Use `BenchCase.invoke()` to call the workload function.
	 */
	async onCase(_, case_, metrics) {
		metrics.size = (await case_.invoke()).length;
	},
};

const decompressProfiler: Profiler = {
	onStart: ctx => ctx.defineMetric({
		key: "decompress",
		format: "{duration.ms}",
		analysis: MetricAnalysis.Statistics,
		lowerIsBetter: true,
	}),
	async onCase(ctx, case_, metrics) {
		// Get decompress function of the case.
		let decompress: typeof inflateSync;
		switch (case_.name) {
			case "deflate":
				decompress = inflateSync;
				break;
			case "gzip":
				decompress = unzipSync;
				break;
			case "brotli":
				decompress = brotliDecompressSync;
				break;
		}

		// `ctx.info()` can write a log to the host.
		ctx.info("Measuring decompress performance...");

		// Get the compressed data.
		const zipped = await case_.invoke();

		// Reuse the options of TimeProfiler.
		let options = ctx.suite.timing;
		if (options === false) {
			return;
		}
		if (options === true) {
			options = undefined;
		}

		/*
		 * Use `BenchCase.derive` to create a new case. Derived case is
 		 * can be thought of as another aspect of the original case.
 		 */
		const newCase = case_.derive(false, () => decompress(zipped));

		/*
		 * ExecutionTimeMeasurement can be used for accurately measure
		 * the execution time of a benchmark case.
		 */
		const measurer = new ExecutionTimeMeasurement(ctx, newCase, options);
		metrics.decompress = await measurer.run();
	},
};

export default defineSuite({
	baseline: { type: "Name", value: "deflate" },
	// Add profilers to the suite.
	profilers: [
		dataSizeProfiler,
		decompressProfiler,
	],
	setup(scene) {
		scene.bench("deflate", () => deflateSync(data));
		scene.bench("gzip", () => gzipSync(data));
		scene.bench("brotli", () => brotliCompressSync(data));
	},
});
