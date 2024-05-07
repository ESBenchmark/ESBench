import * as readline from "readline";
import { defineConfig, ProcessExecutor } from "esbench/host";
import CDP from "chrome-remote-interface";

/*
 * Does the Node debugger have any notable performance impact?
 *
 * Suite: Sum using for-loop vs Array.reduce
 * | No. |      Name |     Executor |      time | time.SD |
 * | --: | --------: | -----------: | --------: | ------: |
 * |   0 | For-index |         node | 748.07 ns | 0.28 ns |
 * |   1 | For-index | debug-attach | 748.44 ns | 0.42 ns |
 * |   2 | For-index |        debug | 748.56 ns | 0.81 ns |
 */
class NodeDebugExecutor extends ProcessExecutor {

	constructor(attach) {
		super(attach ? "node --inspect-brk=33333" : "node --inspect");
		this.attach = attach;
	}

	get name() {
		return this.attach ? "debug-attach" : "debug";
	}

	async postprocess(options) {
		if (this.attach) {
			this.attachDebugger();
		}
		return super.postprocess(options);
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
	toolchains: [{
		include: ["./es/*.js"],
		executors: [
			new ProcessExecutor("node"),
			new NodeDebugExecutor(true),
			new NodeDebugExecutor(false),
		],
	}],
});
