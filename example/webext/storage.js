import { defineSuite } from "esbench";
import packageJson from "../package.json" with { type: "json" };

if (globalThis.browser === undefined) {
	globalThis.browser = chrome;
}

export default defineSuite(async scene => {
	// Read object.
	// localStorage vs CacheStorage vs browser.storage.local
	localStorage.setItem("foo", JSON.stringify(packageJson));
	await browser.storage.local.set(packageJson);
	const cs = await caches.open("test");
	await cs.put("http://example.com", new Response(JSON.stringify(packageJson)));

	scene.bench("localStorage", () => {
		return JSON.parse(localStorage.getItem("foo"));
	});

	scene.benchAsync("browser.storage", () => {
		return browser.storage.local.get();
	});

	scene.benchAsync("CacheStorage", async () => {
		return (await cs.match("http://example.com")).json();
	});
});
