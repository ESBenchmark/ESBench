import { cartesianObject } from "@kaciras/utilities/browser";
import { Metrics, SuiteResult } from "./runner.js";

export interface SceneResult {
	name: string;
	params: Record<string, string>;
	metrics: Metrics;
	engine?: string;
	builder?: string;
}

export type ESBenchResult = Record<string, SceneResult[]>;

export class ResultCollector {

	private readonly result: ESBenchResult;

	private readonly engine?: string;
	private readonly builder?: string;

	constructor(result: ESBenchResult, engine?: string, builder?: string) {
		this.result = result;
		this.engine = engine;
		this.builder = builder;
	}

	collect(name: string, { scenes, paramDef }: SuiteResult) {
		const { engine, builder } = this;
		const cases = this.result[name] ??= [];
		const paramsIter = cartesianObject(paramDef)[Symbol.iterator]();

		for (const scene of scenes) {
			const params = paramsIter.next().value;
			for (const [name, metrics] of scene) {
				cases.push({ params, engine, builder, name, metrics });
			}
		}
	}
}
