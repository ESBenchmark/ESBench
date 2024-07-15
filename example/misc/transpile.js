import { defineSuite } from "esbench";

const consume = () => {};

export default defineSuite(scene => {
	const values = Array.from({ length: 100 }, (_, i) => i);

	scene.benchAsync("async iter", async () => {
		for await (const v of values) consume(v);
	});
});
