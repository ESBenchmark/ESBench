import { defineSuite } from "esbench";

export default defineSuite({
	name: "Async vs Sync function returns Promise",
	params: {
		returns: ["Promise", "Non-Promise"],
	},
	baseline: {
		type: "Name",
		value: "sync",
	},
	setup(scene) {
		const value = scene.params.returns === "Promise"
			? Promise.resolve(11) : 11;

		scene.benchAsync("sync", () => value);
		scene.benchAsync("async", async () => value);
	},
});
