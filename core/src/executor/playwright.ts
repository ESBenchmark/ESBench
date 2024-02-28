import type { BrowserContext, BrowserType, LaunchOptions, Page } from "playwright-core";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { tmpdir } from "os";
import mime from "mime";
import { ExecuteOptions, Executor } from "../host/toolchain.js";
import { ClientMessage } from "../runner.js";

declare function _ESBenchChannel(message: any): void;

// Playwright doesn't work well on about:blank, so we use localhost.
const baseURL = "http://localhost/";

// noinspection HtmlRequiredLangAttribute,HtmlRequiredTitleElement
const pageHTML = {
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

async function client({ files, pattern }: any) {
	// @ts-ignore This module resolved by the custom router.
	const loader = await import("./index.js");
	return loader.default(_ESBenchChannel, files, pattern);
}

/**
 * Run suites on browsers with Playwright driver.
 * Requires "playwright-core" or "playwright" installed.
 *
 * ESBench does not download browsers by default, you may need to specific
 * `executablePath` or run `npx playwright install`.
 *
 * @example
 * import { PlaywrightExecutor } from "esbench/host";
 * import { firefox } from "playwright-core";
 *
 * export default defineConfig({
 *     toolchains: [{
 *         Executors: [new PlaywrightExecutor(firefox)]
 *     }],
 * });
 */
export class PlaywrightExecutor implements Executor {

	readonly type: BrowserType;
	readonly options?: LaunchOptions;

	context!: BrowserContext;
	dataDir?: string;

	constructor(type: BrowserType, options?: LaunchOptions) {
		this.type = type;
		this.options = options;
	}

	get name() {
		return this.type.name();
	}

	async start() {
		console.log("[Playwright] Launching browser...");
		const browser = await this.type.launch(this.options);
		this.context = await browser.newContext();
	}

	async close() {
		await this.context.close();
		await this.context.browser()?.close();
		if (this.dataDir) {
			rmSync(this.dataDir, { recursive: true });
		}
	}

	async initialize(page: Page, options: ExecuteOptions, url: string) {
		const { files, pattern, root, dispatch } = options;
		const [origin] = /^[^:/?#]+:(\/\/)?[^/?#]+/.exec(url)!;

		await page.exposeFunction("_ESBenchChannel", (message: ClientMessage) => {
			if ("e" in message) {
				this.fixStacktrace(message.e, origin, root);
			}
			dispatch(message);
		});
		await page.route(origin + "/**", (route, request) => {
			const path = decodeURIComponent(request.url().slice(origin.length));
			if (path === "/") {
				return route.fulfill(pageHTML);
			}
			const body = readFileSync(join(root, path));
			return route.fulfill({ body, contentType: mime.getType(path)! });
		});

		await page.goto(url);
		await page.evaluate(client, { files, pattern });

		await Promise.all(this.context.pages().map(p => p.close()));
	}

	async execute(options: ExecuteOptions) {
		const page = await this.context.newPage();
		await this.initialize(page, options, baseURL);
	}

	/**
	 * Convert stack trace to Node format, and resolve location to file URL.
	 */
	fixStacktrace(error: any, origin: string, root: string) {
		const { name, message, stack } = error;
		const lines = stack.split("\n") as string[];
		let re: RegExp;

		if (this.type.name() === "chromium") {
			lines.splice(0, 1);
			re = / {4}at (.+?) \((.+?)\)/;
		} else {
			re = /(.*?)@(.+)/;
		}

		for (let i = 0; i < lines.length; i++) {
			let [, fn, pos] = re.exec(lines[i]) ?? [];
			if (!pos) {
				continue;
			}
			if (fn) {
				fn = fn.replace("*", " ");
			} else {
				fn = "<anonymous>";
			}
			if (pos.startsWith(origin)) {
				pos = root + pos.slice(origin.length);
				pos = pathToFileURL(pos).toString();
			}
			lines[i] = `    at ${fn} (${pos})`;
		}

		error.stack = `${name}: ${message}\n` + lines.join("\n");
	}
}

/**
 * Running benchmarks on the extension page, which allows calling the browser extension APIs.
 */
export class WebextExecutor extends PlaywrightExecutor {

	/**
	 * @param type Currently only support chromium.
	 * @param dataDir Path to a User Data Directory, which stores browser session data like cookies and local storage.
	 *                If omitted the data will be saved in a temporary directory.
	 */
	constructor(type: BrowserType, dataDir?: string) {
		super(type);
		this.dataDir = dataDir;
	}

	async start() {
		console.log("[Playwright] Launching browser...");
		const dataDir = this.dataDir ??= mkdtempSync(join(tmpdir(), "browser-"));

		writeFileSync(join(dataDir, "manifest.json"), JSON.stringify(manifest));
		writeFileSync(join(dataDir, "index.html"), pageHTML.body);

		this.context = await this.type.launchPersistentContext(dataDir, {
			args: [
				`--load-extension=${dataDir}`,
				`--disable-extensions-except=${dataDir}`,
			],
		});
	}

	async execute(options: ExecuteOptions) {
		const extensionId = await this.findChromiumExtensionId(manifest.name);
		const baseURL = `chrome-extension://${extensionId}/`;

		const page = await this.context.newPage();
		await this.initialize(page, options, baseURL + "index.html");
	}

	// https://webdriver.io/docs/extension-testing/web-extensions/#test-popup-modal-in-chrome
	async findChromiumExtensionId(name: string) {
		if (this.type.name() !== "chromium") {
			throw new Error("Playwright only supports install extension for chromium");
		}
		const page = await this.context.newPage();
		try {
			await page.goto("chrome://extensions");
			const extensions = await page.$$("extensions-item");
			for (const extension of extensions) {
				const nameEl = await extension.$("#name");
				if (await nameEl?.textContent() === name) {
					return await extension.getAttribute("id");
				}
			}
		} finally {
			await page.close();
		}
		throw new Error("Can't find the extension: " + manifest.name);
	}
}
