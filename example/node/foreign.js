import { defineSuite } from "esbench";

const wasm = await WebAssembly.instantiate(Buffer.from("AGFzbQEAAAABBgFgAX8BfwMCAQAHCAEEZWNobwAACgYBBAAgAAs=", "base64"));


export default defineSuite(scene => {
	scene.bench("WASM", () => wasm.instance.exports.echo(8964));
});
