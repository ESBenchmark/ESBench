export default {
	name: "New Benchmark Suite",
	timing: {
		// Show the number of calls over a period of time rather than the time of one call.
		// throughput: "s",

		// Smaller value for faster runs, default is "1s".
		// iterations: "100ms",

		// Improve running speed without measuring overhead.
		// evaluateOverhead: false,
	},
	setup(scene) {
		scene.bench("case 1", () => {

		});

		// More cases
		// scene.benchAsync("case 2", async () => {});
	},
};
