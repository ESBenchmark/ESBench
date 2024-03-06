import { setPriority } from "os";
import { defineConfig, ProcessExecutor, textReporter } from "esbench/host";

/*
 *
 * Suite: Escape regexp
 * | No. |      Name |   Executor |      time | time.SD | time.ratio |
 * | --: | --------: | ---------: | --------: | ------: | ---------: |
 * |   0 |  use loop |       node |   2.04 us | 3.34 ns |      0.00% |
 * |   1 |  use loop | node (Low) |   2.09 us | 3.69 ns |     +2.38% |
 * |     |           |            |           |         |            |
 * |   2 | use regex |       node | 748.09 ns | 3.08 ns |      0.00% |
 * |   3 | use regex | node (Low) | 775.58 ns | 3.50 ns |     +3.68% |
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
