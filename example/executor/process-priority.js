import { execFile } from "child_process";
import { once } from "events";
import { setPriority } from "os";
import { ProcessExecutor } from "esbench/host";

/*
 * Suite: Escape regexp
 * | No. |      Name |   Executor |     time |   time.SD | time.ratio |
 * | --: | --------: | ---------: | -------: | --------: | ---------: |
 * |   0 |  use loop |       node | 31.46 us | 100.16 ns |      0.00% |
 * |   1 |  use loop | node (Low) | 32.45 us |  71.61 ns |     +3.15% |
 * |     |           |            |          |           |            |
 * |   2 | use regex |       node | 11.97 us |  71.43 ns |      0.00% |
 * |   3 | use regex | node (Low) | 12.28 us |  38.98 ns |     +2.64% |
 */

function splitCommand(command) {
	const quoted = /^"(.+?)(?<!\\)"/.exec(command);
	if (!quoted) {
		const [first, args] = command.split(" ", 2);
		return [first, args ?? ""];
	}
	const [first, unquoted] = quoted;
	return [unquoted, command.slice(first.length)];
}

export default class LowPriorityExecutor extends ProcessExecutor {

	get name() {
		return super.name + " (Low)";
	}

	async executeInProcess(entry) {
		const command = this.getCommand(entry);
		const [file, args] = splitCommand(command);

		this.process?.kill();
		this.process = execFile(file, [args]);

		this.process.on("spawn", () => {
			setPriority(this.process.pid, 19);
		});

		const [code] = await once(this.process, "exit");
		if (code !== 0) {
			throw new Error(`Execute Failed (${code}), Command: ${command}`);
		}
	}
}
