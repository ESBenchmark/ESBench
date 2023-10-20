import { Awaitable, CPSrcObject, ellipsis } from "@kaciras/utilities/browser";
import { SuiteResult, SuiteRunner } from "./worker.js";
import { BenchmarkModule } from "./suite.js";

export function serializable(params: CPSrcObject) {
	const entries = Object.entries(params);
	const processed: Record<string, any[]> = {};
	const counters = new Array(entries.length).fill(0);

	let current: any[];

	for (let i = 0; i < entries.length; i++) {
		const [key, values] = entries[i];
		processed[key] = current = [];

		for (const v of values) {
			const k = counters[i]++;
			switch (typeof v) {
				case "object":
					current.push(v === null ? "null" : `object #${k}`);
					break;
				case "symbol":
					current.push(v.description
						? `symbol(${ellipsis(v.description, 10)}) #${k}`
						: `symbol #${k}`,
					);
					break;
				case "function":
					current.push(`func ${ellipsis(v.name, 10)} #${k}`);
					break;
				default:
					current.push(ellipsis("" + v, 16));
			}
		}
	}

	return processed;
}

export type ClientMessage = { log: string } | { file: string; result: SuiteResult };

export type Importer = (path: string) => Awaitable<{ default: BenchmarkModule<any> }>;

export type Channel = (message: ClientMessage) => Awaitable<void>;

export async function runSuites(
	channel: Channel,
	importer: Importer,
	files: string[],
	name?: string,
) {
	for (const file of files) {
		const { default: suite } = await importer(file);
		const runner = new SuiteRunner(suite, log => channel({ log }));
		channel({ file, result: await runner.bench(name) });
	}
}
