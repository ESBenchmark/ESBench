import { defineSuite } from "esbench";
import packageJson from "../package.json" assert { type: "json" };

if (globalThis.browser === undefined) {
	// noinspection JSUnresolvedVariable; The `chrome` is available in Chromium-based browsers.
	globalThis.browser = chrome;
}

export default defineSuite({
	name: "Browser storage",
	async setup(scene) {
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
	},
});
