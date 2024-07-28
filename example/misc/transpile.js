import { defineSuite } from "esbench";

const consume = () => {};

/**
 * This file will be processed by the compiler to convert the for-await
 * syntax to a generator to test the performance of polyfill code.
 */
export default defineSuite(scene => {
	const values = Array.from({ length: 100 }, (_, i) => i);

	scene.benchAsync("async iter", async () => {
		for await (const v of values) consume(v);
	});
});
