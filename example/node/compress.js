import { readFileSync } from "fs";
import { brotliCompressSync, deflateSync, gzipSync } from "zlib";
import { defineSuite, MetricAnalysis } from "esbench";

const data = readFileSync("../pnpm-lock.yaml");

const dataSizeProfiler = {
	onStart(ctx) {
		ctx.defineMetric({
			key: "size",
			format: "{dataSize}",
			analysis: MetricAnalysis.Compare,
			lowerIsBetter: true,
		});
	},
	async onCase(ctx, case_, metrics) {
		metrics.size = (await case_.invoke()).length;
	},
};

export default defineSuite({
	name: "zlib compress algorithms",
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
