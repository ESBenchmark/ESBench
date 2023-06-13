import { ellipsis } from "@kaciras/utilities/browser";

export enum MessageType {
	Suite,
	Scene,
	Workload,
	Finished,
}

export interface SuiteMessage {
	type: MessageType.Suite;
	file: string;
	paramDefs: Record<string, any[]>;
}

export interface SceneMessage {
	type: MessageType.Scene;
	params: Record<string, any>;
}

export interface WorkloadMessage {
	type: MessageType.Workload;
	name: string;
	metrics: Record<string, any[]>;
}

export interface FinishMessage {
	type: MessageType.Finished;
}

export type WorkerMessage = SuiteMessage | SceneMessage | WorkloadMessage | FinishMessage;

export function serializable(params: Record<string, Iterable<unknown>>) {
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
