import { Awaitable, CPRowObject, CPSrcObject } from "@kaciras/utilities/browser";

type AsyncWorkload = () => Promise<unknown>;

type SyncWorkload = () => unknown;

type Workload = AsyncWorkload | SyncWorkload;

export interface BenchmarkCase {
	name: string;
	isAsync: boolean;
	workload: Workload;
}

export type HookFn = () => Awaitable<unknown>;

export class Scene {

	readonly cases: BenchmarkCase[] = [];

	readonly cleanEach: HookFn[] = [];
	readonly setupIteration: HookFn[] = [];
	readonly cleanIteration: HookFn[] = [];

	beforeIteration(fn: HookFn) {
		this.setupIteration.push(fn);
	}

	afterIteration(fn: HookFn) {
		this.cleanIteration.push(fn);
	}

	afterEach(fn: HookFn) {
		this.cleanEach.push(fn);
	}

	add(name: string, workload: SyncWorkload) {
		this.check(name);
		this.cases.push({ name, workload, isAsync: false });
	}

	addAsync(name: string, workload: AsyncWorkload) {
		this.check(name);
		this.cases.push({ name, workload, isAsync: true });
	}

	private check(name: string) {
		if (/^\s*$/.test(name)) {
			throw new Error("Workload name cannot be a blank string.");
		}
		if (this.cases.some(c => c.name === name)) {
			throw new Error(`Workload "${name}" already exists.`);
		}
	}
}

export type CreateScene<T extends CPSrcObject> = (scene: Scene, params: CPRowObject<T>) => Awaitable<void>;

export type CheckEquality = (a: any, b: any) => boolean;

export interface SuiteConfig {
	samples?: number;
	iterations?: number | string;
	validateExecution?: boolean;
	validateReturnValue?: boolean | CheckEquality;
}

export interface BenchmarkSuite<T extends CPSrcObject> {
	name: string;
	main: CreateScene<T>;
	params?: T;
	afterAll?: HookFn;
	config?: SuiteConfig;
}

type Empty = Record<string, never>;

export function defineSuite<const T extends CPSrcObject = Empty>(suite: BenchmarkSuite<T>) {
	return suite;
}
