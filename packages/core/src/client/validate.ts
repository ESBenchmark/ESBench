import { noop } from "@kaciras/utilities/browser";
import { BenchCase, Scene } from "./suite.js";
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

class PreValidateWorker implements BenchmarkWorker {

	private readonly isEqual: EqualityFn;
	private readonly check: CheckFn;

	private params!: object;
	private nameA!: string;
	private valueA: any = NONE;

	constructor(check: CheckFn, isEqual: EqualityFn) {
		this.check = check;
		this.isEqual = isEqual;
	}

	onScene(_: WorkerContext, __: Scene, params: object) {
		this.params = params;
	}

	async onCase(_: WorkerContext, case_: BenchCase) {
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
