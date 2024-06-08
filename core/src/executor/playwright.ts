import type { BrowserContext, BrowserType, LaunchOptions, Page, Route } from "playwright-core";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { tmpdir } from "os";
import { env, execArgv } from "process";
import { AsyncFunction } from "@kaciras/utilities/node";
import * as importParser from "es-module-lexer";
import { detectTypeScriptCompiler } from "ts-directly";
import { ClientMessage } from "../connect.js";
import { ExecuteOptions, Executor } from "../host/toolchain.js";

// Code may not work well on about:blank, so we use localhost.
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

// Define the function with strings to bypass Vitest transformation.
const client: any = new AsyncFunction("args", `\
	const loader = await import("./index.js");
	return loader.default(_ESBenchPost, args.files, args.pattern);
`);

function hasFlag(flag: string) {
	return execArgv.includes(flag) || env.NODE_OPTIONS?.includes(flag);
}

// Bun has `Bun.resolveSync`, but it's not compatibility with playwright.
const resolveEnabled = hasFlag("--experimental-import-meta-resolve");

function needTransform(specifier: string) {
	return specifier === "/index.js"
		|| specifier.startsWith("/@fs/")
		&& /\.[cm]?[jt]sx?$/.test(specifier);
}

let compileTS;

async function loadModule(specifier: string) {
	let code = readFileSync(specifier, "utf8");

	if (/tsx?$/.test(specifier)) {
		compileTS ??= await detectTypeScriptCompiler();
		code = await compileTS(code, specifier, true);
	}
	return transformImports(code, specifier);
}

function transformImports(code: string, path: string) {
	// Currently `import.meta.resolve` does not work well with URL parent.
	const importer = pathToFileURL(path).toString();
	const [imports] = importParser.parse(code);

	for (const { n, t, s, e } of imports.toReversed()) {
		if (!n) {
			continue;
		}
		// Require `--experimental-import-meta-resolve`
		let path = import.meta.resolve(n, importer);
		path = fileURLToPath(path);
		path = `/@fs/${path.replaceAll("\\", "/")}`;

		const trim = t === 2 ? 1 : 0;
		code = code.slice(0, s + trim) + path + code.slice(e - trim);
	}
	return code;
}

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

	async serve(root: string, path: string, route: Route) {
		if (path === "/") {
			return route.fulfill(pageHTML);
		}
		try {
			if (resolveEnabled && needTransform(path)) {
				// Transformed JS/TS module import
				const file = path === "/index.js"
					? join(root, path) : path.slice(5);

				return route.fulfill({
					body: await loadModule(file),
					contentType: "text/javascript",
				});
			} else if (path.startsWith("/@fs/")) {
				// Transformed asset import
				return await route.fulfill({ path: path.slice(5) });
			} else {
				// Non-import request or resolving disabled.
				return await route.fulfill({ path: join(root, path) });
			}
		} catch (e) {
			if (e.code !== "ENOENT") {
				throw e;
			}
			return route.fulfill({ status: 404 });
		}
	}

	async executeInPage(page: Page, options: ExecuteOptions, url: string) {
		const { files, pattern, root, dispatch } = options;
		const [origin] = /^[^:/?#]+:(\/\/)?[^/?#]+/.exec(url)!;

		await page.exposeFunction("_ESBenchPost", (message: ClientMessage) => {
			if ("e" in message) {
				this.fixStacktrace(message.e, origin, root);
			}
			dispatch(message);
		});
		await this.context.route(origin + "/**", (route, request) => {
			const path = request.url().slice(origin.length);
			return this.serve(root, decodeURIComponent(path), route);
		});

		await page.goto(url);
		await page.evaluate(client, { files, pattern });

		await this.context.unrouteAll();
		await Promise.all(this.context.pages().map(p => p.close()));
	}

	async execute(options: ExecuteOptions) {
		const page = await this.context.newPage();
		await this.executeInPage(page, options, baseURL);
	}

	/**
	 * Convert stack trace to Node format, and resolve location to file URL.
	 */
	fixStacktrace(error: any, origin: string, root: string) {
		const { name, message, stack } = error;
		const lines = stack.split("\n") as string[];
		let re: RegExp;
		let newStack = "";

		if (this.type.name() === "chromium") {
			lines.splice(0, 1);
			re = / {4}at (.+?) \((.+?)\)/;
		} else {
			re = /(.*?)@(.*)/;
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
			newStack += `\n    at ${fn} (${pos})`;
		}

		error.stack = `${name}: ${message}${newStack}`;

		if (error.cause) {
			this.fixStacktrace(error.cause, origin, root);
		}
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
		writeFileSync(join(dataDir, "index.html"), pageHTML.body);

		this.context = await this.type.launchPersistentContext(dataDir, {
			headless: false,
			args: [
				"--headless=new",
				`--load-extension=${dataDir}`,
				`--disable-extensions-except=${dataDir}`,
			],
		});
	}

	async execute(options: ExecuteOptions) {
		const extensionId = await this.findChromiumExtensionId(manifest.name);
		const baseURL = `chrome-extension://${extensionId}/`;

		const page = await this.context.newPage();
		await this.executeInPage(page, options, baseURL + "index.html");
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
