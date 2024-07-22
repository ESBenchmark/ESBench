import { defineSuite } from "esbench";
import initWASM, { run_callback } from "./win32/echo.js";

const callback = () => "Hello World";

/**
 * How much overhead does JS have when calling foreign module?
 *
 * This suite passes a function to WASM and Node addon, which they will call and return the result back.
 *
 * Modules are built from:
 * https://github.com/ESBenchmark/ci-examples/tree/native
 */
export default defineSuite(async scene => {
	// The time it takes to call JS should be close to 0.
	// scene.bench("JS", () => callback());

	scene.bench("wasm-pack", () => run_callback(callback));

	// These 2 cases are only available in Node.
	try {
		const { createRequire } = await import("node:module");
		const { platform } = await import("node:os");
		const { readFileSync } = await import("node:fs");

		const require = createRequire(import.meta.url);
		const rustAddon = require(`./${platform}/napi-rs.node`);
		const cppAddon = require(`./${platform}/napi.node`);
		await initWASM(readFileSync("node/win32/echo_bg.wasm"));

		scene.bench("node-addon-api", () => cppAddon(callback));
		scene.bench("napi-rs", () => rustAddon.runCallback(callback));
	} catch {
		await initWASM(); // Executed in web, let it load with `fetch`.
	}
});
