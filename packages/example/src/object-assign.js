import { defineSuite } from "@esbench/core/client";

export default defineSuite({
	name: "Assign properties to an object",
	setup(scene) {
		const receiver = {};
		const props = { a: 0, b: 0, c: null, sl: 0, sc: 0, el: true, ec: false };

		scene.bench("set values", () => {
			receiver.a = 0;
			receiver.b = 0;
			receiver.c = null;
			receiver.sl = 0;
			receiver.sc = 0;
			receiver.el = true;
			receiver.ec = false;
			return receiver;
		});

		scene.bench("Object.assign", () => {
			return Object.assign(receiver, props);
		});

		scene.bench("literal", () => {
			return { a: 0, b: 0, c: null, sl: 0, sc: 0, el: true, ec: false };
		});
	},
});
