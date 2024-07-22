import { platform } from "node:os";
import { defineSuite } from "esbench";
import initWASM, { run_callback } from "./win32/echo.js";

const { createRequire } = await import("module");
const { readFileSync } = await import("fs");

const require = createRequire(import.meta.url);
const cppAddon = require(`./${platform}/napi.node`);
const rustAddon = require(`./${platform}/napi-rs.node`);
await initWASM(readFileSync("node/win32/echo_bg.wasm"));

const callback = () => "Hello World";

export default defineSuite(async scene => {
	// The time it takes to call JS should be close to 0.
	// scene.bench("JS", () => callback());

	/*
	 * use wasm_bindgen::prelude::*;
	 *
	 * #[wasm_bindgen]
	 * pub fn run_callback(callback: &js_sys::Function) -> JsValue {
	 *     return callback.call0(&JsValue::null()).unwrap();
	 * }
	 */
	scene.bench("wasm-pack", () => run_callback(callback));

	/*
	 * #include <napi.h>
	 *
	 * Napi::Value RunCallback(const Napi::CallbackInfo& info) {
	 *   Napi::Env env = info.Env();
	 *   Napi::Function cb = info[0].As<Napi::Function>();
	 *   return cb.Call(env.Global(), {});
	 * }
	 *
	 * Napi::Object Init(Napi::Env env, Napi::Object exports) {
	 *   return Napi::Function::New(env, RunCallback);
	 * }
	 *
	 * NODE_API_MODULE(addon, Init)
	 */
	scene.bench("node-addon-api", () => cppAddon(callback));

	/*
	 * use napi::bindgen_prelude::*;
	 * use napi_derive::napi;
	 *
	 * #[napi]
	 * pub fn run_callback(callback: JsFunction) -> String {
	 *     return callback.call0().unwrap();
	 * }
	 */
	scene.bench("napi-rs", () => rustAddon.runCallback(callback));
});
