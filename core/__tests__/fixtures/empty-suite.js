import { defineSuite } from "../../lib/index.js";

export default defineSuite({
	timing: false,
	setup() {},
	profilers: [{
		onStart: ctx => ctx.defineMetric({ key: "foobar" }),
	}],
});
