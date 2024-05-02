import { defineSuite } from "esbench";

class BaseClass {
	method() {
		return 114514;
	}
}

class Combination {
	base = new BaseClass();

	delegate() {
		return this.base.method();
	}
}

class ChildClass extends BaseClass {
	delegate() {
		return super.method();
	}
}

export default defineSuite({
	validate: {
		check: value => value === true,
	},
	setup(scene) {
		const comb = new Combination();
		const inherit = new ChildClass();

		scene.bench("combine - create", () => new Combination());
		scene.bench("inherit - create", () => new ChildClass());

		scene.bench("combine - delegate", () => comb.delegate());
		scene.bench("inherit - delegate", () => inherit.delegate());
		scene.bench("inherit - get", () => inherit.method());
	},
});
