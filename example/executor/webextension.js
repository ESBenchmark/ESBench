import { mkdtempSync, rmdirSync, writeFileSync } from "fs";
import { join } from "path";
import os from "os";
import { PlaywrightExecutor } from "esbench/host";

// noinspection HtmlRequiredLangAttribute,HtmlRequiredTitleElement
const PageHTML = {
	headers: {
		"Cross-Origin-Opener-Policy": "same-origin",
		"Cross-Origin-Embedder-Policy": "require-corp",
	},
	contentType: "text/html",
	body: "<html><head></head><body></body></html>",
};

const manifest = {
	name: "ESBench-Webext-Executor",
	manifest_version: 3,
	version: "1.0.0",
	host_permissions: ["*://*/*"],
	cross_origin_embedder_policy: {
		value: "require-corp",
	},
	cross_origin_opener_policy: {
		value: "same-origin",
	},
	permissions: [
		"activeTab", "alarms", "audio", "background", "bookmarks", "browsingData", "certificateProvider",
		"clipboardRead", "clipboardWrite", "contentSettings", "contextMenus", "cookies", "debugger",
		"declarativeContent", "declarativeNetRequest", "declarativeNetRequestWithHostAccess",
		"declarativeNetRequestFeedback", "dns", "desktopCapture", "documentScan", "downloads", "downloads.open",
		"downloads.ui", "enterprise.deviceAttributes", "enterprise.hardwarePlatform", "enterprise.networkingAttributes",
		"enterprise.platformKeys", "favicon", "fileBrowserHandler", "fileSystemProvider", "fontSettings",
		"gcm", "geolocation", "history", "identity", "identity.email", "idle", "loginState", "management",
		"nativeMessaging", "notifications", "offscreen", "pageCapture", "platformKeys", "power", "printerProvider",
		"printing", "printingMetrics", "privacy", "processes", "proxy", "readingList", "runtime", "scripting",
		"search", "sessions", "sidePanel", "storage", "system.cpu", "system.display", "system.memory",
		"system.storage", "tabCapture", "tabGroups", "tabs", "topSites", "tts", "ttsEngine", "unlimitedStorage",
		"vpnProvider", "wallpaper", "webAuthenticationProxy", "webNavigation", "webRequest", "webRequestBlocking",
	],
};

export default class WebextExecutor extends PlaywrightExecutor {

	async start() {
		console.log("[Playwright] Launching browser...");
		const dataDir = mkdtempSync(join(os.tmpdir(), "browser-"));

		writeFileSync(join(dataDir, "manifest.json"), JSON.stringify(manifest));
		writeFileSync(join(dataDir, "index.html"), PageHTML.body);

		this.context = await this.type.launchPersistentContext(dataDir, {
			headless: false,
			args: [
				`--load-extension=${dataDir}`,
				`--disable-extensions-except=${dataDir}`,
			],
		});
		this.context.on("close", () => rmdirSync(dataDir));
	}

	async execute(options) {
		const extensionId = await this.findChromiumExtensionId(manifest.name);
		const baseURL = `chrome-extension://${extensionId}/`;

		const page = await this.context.newPage();
		await this.initialize(page, options, baseURL + "index.html");
	}

	// https://webdriver.io/docs/extension-testing/web-extensions/#test-popup-modal-in-chrome
	async findChromiumExtensionId(name) {
		if (this.type.name() !== "chromium") {
			throw new Error("Playwright only supports install extension for chromium");
		}
		const page = await this.context.newPage();
		try {
			await page.goto("chrome://extensions");
			const extensions = await page.$$("extensions-item");
			for (const extension of extensions) {
				const nameEl = await extension.$("#name");
				if (await nameEl.textContent() === name) {
					return await extension.getAttribute("id");
				}
			}
		} finally {
			await page.close();
		}
		throw new Error("Can't find the extension: " + manifest.name);
	}
}
