import ChildProcess from "child_process";
import v8 from "v8";
import { performance } from "perf_hooks";

export type BenchmarkFunction = (controller: BenchmarkController, config: any) => void | Promise<void>;

export class BenchmarkController {

	private heapSize?: number;
	private startTime?: number;

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
