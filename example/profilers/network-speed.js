import { defineSuite } from "esbench";

/*
 * Benchmark network speed with third-party endpoints, the result are
 * dependent on your ISP and in some cases may not be able to connect.
 *
 * This suite does not work on browsers due to CORS policy.
 */
const downloadURL = "http://speedtest.newark.linode.com/100MB-newark.bin";
const uploadURL = "https://dallas17.testmy.net/b/uploader";

const speedProfiler = {
	onStart: ctx => ctx.defineMetric({
		key: "bandwidth",
		format: "{dataSize}/s",
		analysis: 1,
		lowerIsBetter: false,
	}),
	/*
	 * The case returns the amount of data transferred,
	 * timed here, and divided to get the bandwidth.
	 */
	async onCase(ctx, case_, metrics) {
		const begin = performance.now();
		const size = await case_.invoke();
		const end = performance.now();
		metrics.bandwidth = size / (end - begin) * 1000;
	},
};

export default defineSuite({
	profilers: [speedProfiler],
	timing: false,
	setup(scene) {
		scene.benchAsync("download", async () => {
			const response = await fetch(downloadURL);
			let size = 0;
			for await (const chunk of response.body) {
				size += chunk.byteLength;
			}
			return size;
		});
		scene.benchAsync("upload", async () => {
			const body = new Uint8Array(10 * 1024 * 1024);
			await fetch(uploadURL, { method: "POST", body });
			return body.byteLength;
		});
	},
});
