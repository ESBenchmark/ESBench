import { alwaysTrue, noop } from "@kaciras/utilities/browser";
import { BenchCase, Scene } from "./suite.js";
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

export class ValidationError extends Error {

	/** Name of the benchmark */
	readonly workload: string;

	/** Parameters of the scene */
	readonly params: object;

	constructor(params: object, workload: string, message: string, options?: any) {
		super(message, options);
		this.params = params;
		this.workload = workload;
	}
}

ValidationError.prototype.name = "ValidationError";

const NONE = Symbol();

class PreValidateProfiler implements Profiler {

	private readonly isEqual: EqualityFn;
	private readonly check: CheckFn;

	private params!: object;
	private nameA!: string;
	private valueA: any = NONE;

	constructor(check: CheckFn, isEqual: EqualityFn) {
		this.check = check;
		this.isEqual = isEqual;
	}

	onScene(_: ProfilingContext, scene: Scene) {
		this.params = scene.params;
		this.valueA = NONE;
	}

	async onCase(_: ProfilingContext, case_: BenchCase) {
		const { nameA, valueA, isEqual, check } = this;
		const { name } = case_;

		let returnValue;
		try {
			returnValue = await case_.invoke();
		} catch (cause) {
			this.fail(name, `Failed to execute benchmark "${name}"`, cause);
		}

		try {
			check(returnValue);
		} catch (cause) {
			this.fail(name, `"${name}" returns incorrect value`, cause);
		}

		if (valueA === NONE) {
			this.valueA = returnValue;
			this.nameA = name;
		} else if (!isEqual(valueA, returnValue)) {
			this.fail(name, `"${nameA}" and "${name}" returns different value.`);
		}
	}

	private fail(name: string, message: string, cause?: Error) {
		throw new ValidationError(this.params, name, message, { cause });
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
