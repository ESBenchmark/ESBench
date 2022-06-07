import { fork } from "child_process";
import { CaseResult } from "./core.js";

	start() {
		global.gc();
		this.heapSize = v8.getHeapStatistics().used_heap_size;
		this.startTime = performance.now();
	}

	end(name: any, category?: any) {
		const time = performance.now() - this.startTime!;
		const memory = v8.getHeapStatistics().used_heap_size - this.heapSize!;

		if (!this.heapSize) {
			throw new Error("called end() without start");
		}
		process.send!({ name, category, memory, time });
	}
}

async function runBenchmark(fn: BenchmarkFunction) {
	const configs = await new Promise<any[]>(resolve => process.once("message", resolve));

	for (const config of configs) {
		const controller = new BenchmarkController();
		await fn(controller, config);
	}

	return process.exit(0); // Force exit, ignore any running task
}
