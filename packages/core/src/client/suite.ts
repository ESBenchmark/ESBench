import { Awaitable, CPRowObject, CPSrcObject } from "@kaciras/utilities/browser";

export type AsyncWorkload = () => Promise<unknown>;

export type SyncWorkload = () => unknown;

export type Workload = AsyncWorkload | SyncWorkload;

type CheckEquality = (a: any, b: any) => boolean;

export interface SuiteOptions {
	samples?: number;
	iterations?: number | string;
	validateExecution?: boolean;
	validateReturnValue?: boolean | CheckEquality;
}

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
		if (this.cases.some(c => c.name === name)) {
			throw new Error(`Workload "${name}" already exists.`);
		}
	}
}

export type CreateScene<T extends CPSrcObject> = (scene: Scene, params: CPRowObject<T>) => Awaitable<void>;

export interface BenchmarkSuite<T extends CPSrcObject> {
	main: CreateScene<T>;
	params?: T;
	afterAll?: HookFn;
	options?: SuiteOptions;
}

type Empty = Record<string, never>;

export function defineSuite<const T extends CPSrcObject = Empty>(suite: BenchmarkSuite<T>) {
	return suite;
}
