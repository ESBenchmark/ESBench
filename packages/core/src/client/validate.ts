import { BenchCase, EqualityFn, Scene } from "./suite.js";
import { BenchmarkWorker, ForEachScene } from "./runner.js";

const NONE = Symbol();

export class ValidateWorker implements BenchmarkWorker {

	private readonly isEqual: EqualityFn;

	private value: any = NONE;

	constructor(option?: boolean | EqualityFn) {
		if (option === true) {
			this.isEqual = (a, b) => a === b;
		} else if (option) {
			this.isEqual = option;
		} else {
			this.isEqual = () => true;
		}
	}

	async onSuite(forEach: ForEachScene) {
		await forEach(async scene => {
			for (const case_ of scene.cases) {
				await this.validate(scene, case_);
			}
		});
	}

	private async validate(scene: Scene, case_: BenchCase) {
		const { value, isEqual } = this;
		const current = await case_.invoke();

		if (value === NONE) {
			this.value = current;
		} else if (!isEqual(value, current)) {
			const { name } = scene.cases[0];
			throw new Error(`${case_.name} and ${name} returns different value.`);
		}
	}
}
