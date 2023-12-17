import { defineSuite } from "@esbench/core/client";

export default defineSuite({
	name: "Async without await",
	params: {
		returns: ["promise", "non-promise"],
	},
	baseline: {
		type: "Name",
		value: "sync",
	},
	setup(scene) {
		const value = scene.params.returns === "promise"
			? Promise.resolve(11) : 11;
		scene.benchAsync("async", async () => value);
		scene.benchAsync("sync", () => value);
	},
});
