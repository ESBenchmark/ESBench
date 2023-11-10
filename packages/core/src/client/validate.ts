import { noop } from "@kaciras/utilities/browser";
import { BenchCase } from "./suite.js";
import { BenchmarkWorker, WorkerContext } from "./runner.js";

export type CheckFn = (value: any) => void;

export type EqualityFn = (a: any, b: any) => boolean;

export interface ValidateOptions {
	/**
	 * Check the return value of benchmarks, throw an error if it's invalid.
	 */
	correctness?: CheckFn;
	/**
	 * Check to make sure the values returned by the benchmarks are equal.
	 */
	equality?: boolean | EqualityFn;
}

const NONE = Symbol();

class PreValidateWorker implements BenchmarkWorker {

	private readonly isEqual: EqualityFn;
	private readonly check: CheckFn;

	private nameA!: string;
	private valueA: any = NONE;

	constructor(check: CheckFn, isEqual: EqualityFn) {
		this.check = check;
		this.isEqual = isEqual;
	}

	async onCase(_: WorkerContext, case_: BenchCase) {
		const { nameA, valueA, isEqual, check } = this;
		const { name } = case_;
		const returnValue = await case_.invoke();

		check(returnValue);

		if (valueA === NONE) {
			this.valueA = returnValue;
			this.nameA = name;
		} else if (!isEqual(valueA, returnValue)) {
			throw new Error(`"${name}" and "${nameA}" returns different value.`);
		}
	}
}

export class ValidateWorker implements BenchmarkWorker {

	private readonly isEqual: EqualityFn;
	private readonly check: CheckFn;

	constructor({ equality, correctness }: ValidateOptions) {
		this.check = correctness ?? noop;
		if (equality === true) {
			this.isEqual = (a, b) => a === b;
		} else if (equality) {
			this.isEqual = equality;
		} else {
			this.isEqual = () => true;
		}
	}

	onSuite(ctx: WorkerContext) {
		return ctx.run([new PreValidateWorker(this.check, this.isEqual)]);
	}
}
