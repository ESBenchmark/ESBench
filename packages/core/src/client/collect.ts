import { cartesianObject } from "@kaciras/utilities/browser";
import { Metrics, SuiteResult } from "./worker.js";

export interface SceneResult {
	name: string;
	params: Record<string, string>;
	metrics: Metrics;
	engine?: string;
	transformer?: string;
}

export type ESBenchResult = Record<string, SceneResult[]>;

export class ResultCollector {

	private readonly result: ESBenchResult;

	private readonly engine?: string;
	private readonly transformer?: string;

	constructor(result: ESBenchResult, engine?: string, transformer?: string) {
		this.result = result;
		this.engine = engine;
		this.transformer = transformer;
	}

	collect(name: string, { scenes, paramDef }: SuiteResult) {
		const { engine, transformer } = this;
		const cases = this.result[name] ??= [];
		const paramsIter = cartesianObject(paramDef)[Symbol.iterator]();

		for (const scene of scenes) {
			const params = paramsIter.next().value;
			for (const [name, metrics] of scene) {
				cases.push({ params, engine, transformer, name, metrics });
			}
		}
	}
}
