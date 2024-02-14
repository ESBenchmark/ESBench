import { readFileSync, writeFileSync } from "fs";
import { join, relative, resolve } from "path";
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

async function client({ files, pattern }) {
	// @ts-ignore This module resolved by the custom router.
	const loader = await import("./index.js");
	return loader.default(_ESBenchChannel, files, pattern);
}

const UUID = "{CA54AB6B-7DE6-48AD-B5AF-12E841A3132C}";

const manifest = {
	name: "ESBench-Webext-Executor",
	manifest_version: 3,
	version: "1.0.0",
	browser_specific_settings: {
		gecko: { id: UUID },
	},
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
	}

	close() {
		return this.context.close();
	}

	async execute(options) {
		const { tempDir, files, pattern, root, dispatch } = options;

		writeFileSync(join(tempDir, "manifest.json"), JSON.stringify({
			...manifest,
		}));

		const specifier = relative(tempDir, join(root, "index.js"))
			.replaceAll("\\", "/");

		const template = `\
import connect from "__ENTRY__";
connect(_ESBenchChannel, __FILES__, __PATTERN__);`;

		const loaderCode = template
			.replace("__FILES__", JSON.stringify(files))
			.replace("__PATTERN__", JSON.stringify(pattern))
			.replace("__ENTRY__", "./" + specifier);

		// No need to make the filename unique because only one executor can run at the same time.
		const script = join(tempDir, "main.js");
		writeFileSync(script, loaderCode);

		const dataDir = resolve(tempDir);
		const context = this.context = await this.type.launchPersistentContext(dataDir, {
			headless: false,
			args: [
				`--load-extension=${dataDir}`,
				`--disable-extensions-except=${dataDir}`,
			],
		});

		await context.exposeFunction("_ESBenchChannel", (message) => {
			if ("e" in message) {
				this.fixStacktrace(message.e, page, root);
			}
			dispatch(message);
		});

		const extensionId = await this.getExtensionId(context);
		const baseURL = `chrome-extension://${extensionId}/`;

		const page = await context.newPage();

		await page.route(new RegExp(), (route, request) => {
			const url = request.url();
			if (url === baseURL) {
				return route.fulfill(PageHTML);
			}
			const path = decodeURIComponent(url.slice(baseURL.length - 1));
			const body = readFileSync(join(root, path));
			return route.fulfill({ body, contentType: "text/javascript" });
		});

		await page.goto(baseURL + "index.html");
		await page.evaluate(client, { files, pattern });
		await page.close();
	}

	// https://webdriver.io/docs/extension-testing/web-extensions/#test-popup-modal-in-chrome
	async getExtensionId(context) {
		if (this.type.name() === "firefox") {
			return UUID;
		}
		const page = await context.newPage();
		context.setDefaultTimeout(0);
		try {
			await page.goto("chrome://extensions");
			const extensions = await page.$$("extensions-item");
			for (const extension of extensions) {
				const nameEl = await extension.$("#name");
				if (await nameEl.textContent() === manifest.name) {
					return await extension.getAttribute("id");
				}
			}
		} finally {
			await page.close();
		}
		throw new Error("Can't find the extension: " + manifest.name);
	}
}
