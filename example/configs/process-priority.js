import { setPriority } from "os";
import { defineConfig, ProcessExecutor, textReporter } from "esbench/host";

/*
 *
 * Suite: Escape regexp
 * | No. |      Name |   Executor |     time |   time.SD | time.ratio |
 * | --: | --------: | ---------: | -------: | --------: | ---------: |
 * |   0 |  use loop |       node | 31.46 us | 100.16 ns |      0.00% |
 * |   1 |  use loop | node (Low) | 32.45 us |  71.61 ns |     +3.15% |
 * |     |           |            |          |           |            |
 * |   2 | use regex |       node | 11.97 us |  71.43 ns |      0.00% |
 * |   3 | use regex | node (Low) | 12.28 us |  38.98 ns |     +2.64% |
 */
class LowPriorityExecutor extends ProcessExecutor {

	get name() {
		return super.name + " (Low)";
	}

	postprocess(entry, options) {
		super.postprocess(entry, options);
		this.process.removeAllListeners("spawn");
		this.process.on("spawn", () => {
			setPriority(this.process.pid, 19);
		});
	}
}

export default defineConfig({
	reporters: [textReporter({ stdDev: true })],
	toolchains: [{
		include: ["./src/*.js"],
		executors: [
			new ProcessExecutor("node"),
			new LowPriorityExecutor("node"),
		],
	}],
});
