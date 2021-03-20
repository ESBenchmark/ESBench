import ChildProcess from "child_process";
import v8 from "v8";
import { performance } from "perf_hooks";
import bytes from "bytes";

export type BenchmarkFunction = (controller: BenchmarkController, config: any) => void | Promise<void>;

interface BenchmarkResult {

	/** Name of the benchmark case or target */
	name: any;

	/** Used for result grouping */
	category?: any;

	/** Time usage in milliseconds */
	time: number;

	/** Used heap size in bytes */
	memory: number;
}

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

export function runBenchmarks(fn: BenchmarkFunction, configs: any[]): Promise<BenchmarkResult[]> {
	if (process.env.BENCHMARK_CHILD) {
		return runBenchmark(fn);
	} else {
		const childEnv = Object.assign({}, process.env);
		childEnv.BENCHMARK_CHILD = "true";

		const child = ChildProcess.fork(require.main!.filename, [], {
			env: childEnv,
			execArgv: ["--expose-gc"],
		});
		child.send(configs);
		const results: BenchmarkResult[] = [];

		child.on("message", (result: BenchmarkResult) => {
			results.push(result);
			console.debug(`${result.name} - Time：${result.time.toFixed(2)}ms，Memory：${bytes(result.memory)}`);
		});

		return new Promise(resolve => child.on("exit", () => resolve(results)));
	}
}
