import { alwaysTrue, noop } from "@kaciras/utilities/browser";
import { BenchCase } from "./suite.js";
import { Profiler, ProfilingContext } from "./context.js";

type EqualityFn = (a: any, b: any) => boolean;

type CheckFn = (value: any) => void;

export interface ValidateOptions {
	/**
	 * Check the return value of benchmarks, throw an error if it's invalid.
	 */
	check?: CheckFn;

	/**
	 * Check to make sure the values returned by the function are equal.
	 *
	 * The value can be a function, or true means check with `===`.
	 */
	equality?: boolean | EqualityFn;
}

const NONE = Symbol();

class PreValidateProfiler implements Profiler {

	private readonly isEqual: EqualityFn;
	private readonly check: CheckFn;

	private nameA!: string;
	private valueA: any = NONE;

	constructor(check: CheckFn, isEqual: EqualityFn) {
		this.check = check;
		this.isEqual = isEqual;
	}

	onScene() {
		this.valueA = NONE;
	}

	async onCase(_: ProfilingContext, case_: BenchCase) {
		const { nameA, valueA, isEqual, check } = this;
		const { name } = case_;

		const returnValue = await case_.invoke();
		check(returnValue);

		if (valueA === NONE) {
			this.valueA = returnValue;
			this.nameA = name;
		} else if (!isEqual(valueA, returnValue)) {
			throw new Error(`"${nameA}" and "${name}" returns different value.`);
		}
	}
}

export class ExecutionValidator implements Profiler {

	private readonly isEqual: EqualityFn;
	private readonly check: CheckFn;

	constructor({ equality, check }: ValidateOptions) {
		this.check = check ?? noop;
		if (equality === true) {
			this.isEqual = (a, b) => a === b;
		} else if (equality) {
			this.isEqual = equality;
		} else {
			this.isEqual = alwaysTrue;
		}
	}

	/**
	 * To catch errors as early as possible, we start a new workflow for the validator.
	 */
	async onStart(ctx: ProfilingContext) {
		await ctx.info("Validating benchmarks...");
		const validator = new PreValidateProfiler(this.check, this.isEqual);
		await ctx.newWorkflow([validator]).run();
	}
}
