import { defineSuite } from "esbench";

export default defineSuite(scene => {
	const receiver = {};
	const props = { a: 0, b: 0, c: null, sl: 0, sc: 0, el: true, ec: false };

	scene.bench("set values", () => {
		receiver.a = 11;
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

	// TODO: this cause Chromium to run IDLE for a long time.
	scene.bench("literal", () => {
		return { a: 11, b: 0, c: null, sl: 0, sc: 0, el: true, ec: false };
	});
});
