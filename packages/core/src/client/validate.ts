import { BenchCase, EqualityFn, Scene } from "./suite.js";
import { BenchmarkWorker, WorkerContext } from "./runner.js";

const NONE = Symbol();

class PreValidateWorker implements BenchmarkWorker {

	private readonly isEqual: EqualityFn;

	private scene!: Scene;
	private value: any = NONE;

	constructor(isEqual: EqualityFn) {
		this.isEqual = isEqual;
	}

	onScene(_: WorkerContext, scene: Scene) {
		this.scene = scene;
	}

	async onCase(_: WorkerContext, case_: BenchCase) {
		const { scene, value, isEqual } = this;
		const current = await case_.invoke();

		if (value === NONE) {
			this.value = current;
		} else if (!isEqual(value, current)) {
			const { name } = scene.cases[0];
			throw new Error(`${case_.name} and ${name} returns different value.`);
		}
	}
}

export class ValidateWorker implements BenchmarkWorker {

	private readonly isEqual: EqualityFn;

	constructor(option?: boolean | EqualityFn) {
		if (option === true) {
			this.isEqual = (a, b) => a === b;
		} else if (option) {
			this.isEqual = option;
		} else {
			this.isEqual = () => true;
		}
	}

	onSuite(ctx: WorkerContext) {
		return ctx.run([new PreValidateWorker(this.isEqual)]);
	}
}
