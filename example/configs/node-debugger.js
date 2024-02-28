import * as readline from "readline";
import { defineConfig, ProcessExecutor, textReporter } from "esbench/host";
import CDP from "chrome-remote-interface";

/*
 * Suite: Sum using for-loop vs Array.reduce
 * | No. |         Name |           Executor |     time |     time.SD | time.ratio |
 * | --: | -----------: | -----------------: | -------: | ----------: | ---------: |
 * |   0 |    For-index | node-debug-connect | 11.80 us |     6.00 ns |     -0.34% |
 * |   1 |    For-index |               node | 11.84 us |     7.07 ns |      0.00% |
 * |   2 |    For-index |         node-debug | 11.79 us |     6.72 ns |     -0.37% |
 */
class NodeDebugExecutor extends ProcessExecutor {

	constructor(connect) {
		super(connect ? "node --inspect-brk=33333" : "node --inspect");
		this.connect = connect;
	}

	get name() {
		return this.connect ? "node-debug-connect" : "node-debug";
	}

	async postprocess(entry, fail) {
		if (this.connect) {
			this.attachDebugger();
		}
		return super.postprocess(entry, fail);
	}

	attachDebugger() {
		const rl = readline.createInterface(this.process.stderr);
		rl.on("line", async line => {
			if (line.endsWith("failed: address already in use")) {
				console.error("Inspect failed: address already in use");
				process.exit(3);
			}
			if (line.startsWith("Debugger listening on ")) {
				rl.close();
				const client = await CDP({ port: 33333 });
				await client.Runtime.runIfWaitingForDebugger();
				this.process.on("exit", () => client.close());
			}
		});
	}
}

export default defineConfig({
	reporters: [textReporter({ stdDev: true })],
	toolchains: [{
		include: ["./src/*.js"],
		executors: [
			new ProcessExecutor("node"),
			new NodeDebugExecutor(true),
			new NodeDebugExecutor(false),
		],
	}],
});
