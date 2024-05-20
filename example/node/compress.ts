import { readFileSync } from "fs";
import { brotliCompressSync, deflateSync, gzipSync } from "zlib";
import { defineSuite, MetricAnalysis, Profiler } from "esbench";

const data = readFileSync("../pnpm-lock.yaml");

const dataSizeProfiler: Profiler = {
	onStart: ctx => ctx.defineMetric({
		key: "size",
		format: "{dataSize}",
		analysis: MetricAnalysis.Compare,
		lowerIsBetter: true,
	}),
	async onCase(_, case_, metrics) {
		metrics.size = (await case_.invoke()).length;
	},
};

export default defineSuite({
	baseline: { type: "Name", value: "deflate" },
	profilers: [dataSizeProfiler],
	setup(scene) {
		scene.bench("deflate", () => deflateSync(data));
		scene.bench("gzip", () => gzipSync(data));
		scene.bench("brotli", () => brotliCompressSync(data));
	},
});
