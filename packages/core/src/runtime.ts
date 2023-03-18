import glob from "fast-glob";
import { CaseMessage, MessageType, SuiteOptions, TurnMessage } from "./core.js";
import consoleReporter from "./report.js";
import { Awaitable } from "@kaciras/utilities/node";
import { ViteAdapter } from "./vite.js";

export interface BenchmarkScript {
	default: SuiteOptions;
}

type Reporter = (result: SuiteResult[]) => void | Promise<void>;

export interface Scene {
	name: string;
	runner: BenchmarkRunner;
}

export interface RunnerOptions {
	files: string[];
	scenes?: Scene[];
	reporter?: Reporter;
}

interface Metrics {
	unit: string;
}

export interface SuiteResult {
	file: string;
	metrics: Record<string, Metrics>;
	runners: RunnerResult[];
}

export interface RunnerResult {
	name: string;
	options: Record<string, any>;
	cases: CaseResult[];
}

export interface CaseResult {
	params: Record<string, any>;
	iterations: Record<string, IterationResult[]>;
}

interface IterationResult {
	time: number;
	memory?: number;
}

export interface RunOptions {
	file: string;
	name?: string;

	handleMessage(message: any): void;

	importModule(specifier: string): Promise<string>;
}

export interface BenchmarkRunner {

	start(): Awaitable<void>;

	close(): Awaitable<void>;

	run(options: RunOptions): Awaitable<void>;
}

const code = `
import { BenchmarkSuite } from "@esbench/core/lib/core.js";
import deff from __FILE__;
const { options, build } = deff;
await new BenchmarkSuite(options, build, sendBenchmarkMessage).bench(__NAME__);
`;

const VMID = "/esbench__loader";

function vitePlugin(file, name) : Plugin {
	return {
		name: "esbench",

		load(id) {
			if(id === VMID) {
				return code
					.replace("__FILE__", "'/"+file+"'")
					.replace("__NAME__", name);
			}
		},
	};
}

export class BenchmarkTool {

	private readonly options: RunnerOptions;

	constructor(options: RunnerOptions) {
		this.options = options;
	}

	async runSuites(files: string[]) {
		const {
			scenes,
			reporter = consoleReporter(),
		} = this.options;

		const { runner } = scenes![0];

		const suiteResults: SuiteResult[] = [];
		await runner.start();

		const vite = await createServer({
			server: {
				hmr: false,
			},
			plugins: [
				vitePlugin(files[0], undefined),
			],
		});

		for (const file of await glob(files)) {
			const cases: CaseResult[] = [];
			const results: RunnerResult = {
				name: "node",
				cases,
				options: {},
			};
			let currentCase: CaseResult;

			await runner.run({
				file,
				name: undefined,
				handleMessage(message: TurnMessage | CaseMessage) {
					if (message.type === MessageType.Case) {
						currentCase = { params: message.params, iterations: {} };
						cases.push(currentCase);
					} else {
						const { name, metrics } = message;
						(currentCase.iterations[name] ??= []).push(metrics);
					}
				},
				async importModule(specifier: string) {
					const r = await vite.transformRequest(specifier);
					if (r) {
						return r.code;
					}
					throw new Error("Can not load module: " + specifier);
					// return readFileSync(specifier, "utf8");
				},
			});

			suiteResults.push({
				file,
				runners: [results],
				metrics: {
					time: { unit: "ms" },
				},
			});
		}

		await runner.close();
		await reporter(suiteResults);
	}

	async run(suite: string, name: string) {

	}
}
