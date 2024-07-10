import type { BrowserContext, BrowserType, LaunchOptions, Route } from "playwright-core";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { AsyncFunction } from "@kaciras/utilities/node";
import * as importParser from "es-module-lexer";
import { ClientMessage } from "../connect.js";
import { Executor, SuiteTask } from "../host/toolchain.js";
import { transformer } from "./transform.js";
import { htmlEntryHeaders } from "./web-remote.js";

// Code may not work well on about:blank, so we use localhost.
const baseURL = "http://localhost/";

// noinspection HtmlRequiredLangAttribute,HtmlRequiredTitleElement
export const blankPageResponse = {
	headers: htmlEntryHeaders,
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
	// Ugly! Is there any string to declare all permissions?
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

// Define the function with strings to bypass Vitest transformation.
const client: any = new AsyncFunction("args", `\
	const loader = await import("./index.js");
	return loader.default(_ESBenchPost, args.file, args.pattern);
`);

/**
 * Run suites on browser with Playwright driver.
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

	constructor(type: BrowserType, options?: LaunchOptions) {
		this.type = type;
		this.options = options;
	}

	get name() {
		return this.type.name();
	}

	async start() {
		const browser = await this.type.launch(this.options);
		await importParser.init;
		this.context = await browser.newContext();
	}

	async close() {
		await this.context.close();
		await this.context.browser()?.close();
	}

	execute(options: SuiteTask) {
		return this.executeInPage(options, baseURL);
	}

	async serve(root: string, path: string, route: Route) {
		if (path === "/") {
			return route.fulfill(blankPageResponse);
		}

		const resolved = transformer.parse(root, path);
		try {
			if (!resolved) {
				// Non-import request or resolving disabled.
				return await route.fulfill({ path: join(root, path) });
			}
			const body = await transformer.load(resolved);
			if (body) {
				// Transformed JS/TS module module.
				return route.fulfill({ body, contentType: "text/javascript" });
			}
			// No need to transform, send the file.
			return await route.fulfill({ path: resolved });
		} catch (e) {
			return route.fulfill({ status: 404, body: e.message });
		}
	}

	async executeInPage(task: SuiteTask, url: string) {
		const { file, pattern, root, dispatch } = task;
		const [origin] = /^[^:/?#]+:(\/\/)?[^/?#]+/.exec(url)!;
		const page = await this.context.newPage();

		await page.exposeFunction("_ESBenchPost", (message: ClientMessage) => {
			if ("e" in message) {
				transformer.fixStack(message.e, origin, root);
			}
			dispatch(message);
		});
		await this.context.route(origin + "/**", (route, request) => {
			const path = request.url().slice(origin.length);
			return this.serve(root, decodeURIComponent(path), route);
		});

		await page.goto(url);
		await page.evaluate(client, { file, pattern });

		await this.context.unrouteAll();
		await Promise.all(this.context.pages().map(p => p.close()));
	}
}

/**
 * Running benchmarks on the extension page, which allows calling the browser extension APIs.
 */
export class WebextExecutor extends PlaywrightExecutor {

	private readonly cleanDataDir: boolean;

	private dataDir?: string;

	/**
	 * @param type Only support chromium.
	 * @param dataDir Path to a User Data Directory, which stores browser session data like cookies and local storage.
	 *                If omitted the data will be saved in a temporary directory.
	 */
	constructor(type: BrowserType, dataDir?: string) {
		super(type);
		if (type.name() !== "chromium") {
			throw new Error("Playwright only supports install extension for chromium");
		}
		this.dataDir = dataDir;
		this.cleanDataDir = dataDir === undefined;
	}

	get name() {
		return this.type.name() + " addon";
	}

	async close() {
		const { cleanDataDir, dataDir } = this;
		await super.close();
		if (dataDir && cleanDataDir) {
			rmSync(dataDir, { recursive: true });
		}
	}

	async start() {
		const dataDir = this.dataDir ??= mkdtempSync(join(tmpdir(), "browser-"));

		writeFileSync(join(dataDir, "manifest.json"), JSON.stringify(manifest));
		writeFileSync(join(dataDir, "index.html"), blankPageResponse.body);

		this.context = await this.type.launchPersistentContext(dataDir, {
			headless: false,
			args: [
				"--headless=new",
				`--load-extension=${dataDir}`,
				`--disable-extensions-except=${dataDir}`,
			],
		});
	}

	async execute(task: SuiteTask) {
		const extensionId = await this.findChromiumExtensionId(manifest.name);
		const baseURL = `chrome-extension://${extensionId}/`;
		return this.executeInPage(task, baseURL + "index.html");
	}

	// https://webdriver.io/docs/extension-testing/web-extensions/#test-popup-modal-in-chrome
	async findChromiumExtensionId(name: string) {
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
