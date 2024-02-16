import type { BrowserContext, BrowserType, LaunchOptions, Page } from "playwright-core";
import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import mime from "mime";
import { ExecuteOptions, Executor } from "../host/toolchain.js";
import { ClientMessage } from "../runner.js";

declare function _ESBenchChannel(message: any): void;

// Playwright doesn't work well on about:blank, so we use localhost.
const baseURL = "http://localhost/";

// noinspection HtmlRequiredLangAttribute,HtmlRequiredTitleElement
const PageHTML = {
	headers: {
		"Cross-Origin-Opener-Policy": "same-origin",
		"Cross-Origin-Embedder-Policy": "require-corp",
	},
	contentType: "text/html",
	body: "<html><head></head><body></body></html>",
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
export default class PlaywrightExecutor implements Executor {

	readonly type: BrowserType;
	readonly options?: LaunchOptions;
	readonly name: string;

	context!: BrowserContext;

	constructor(type: BrowserType, options?: LaunchOptions) {
		this.name = type.name();
		this.type = type;
		this.options = options;
	}

	async start() {
		console.log("[Playwright] Launching browser...");
		const browser = await this.type.launch(this.options);
		this.context = await browser.newContext({ baseURL });
	}

	async close() {
		await this.context.close();
		await this.context.browser()?.close();
	}

	async initialize(page: Page, options: ExecuteOptions, url: string) {
		const { files, pattern, root, dispatch } = options;
		const match = /^[^:/?#]+:(\/\/)?[^/?#]+/.exec(url);
		if (!match) {
			throw new Error("Invalid URL?");
		}
		const origin = match[0];

		await page.exposeFunction("_ESBenchChannel", (message: ClientMessage) => {
			if ("e" in message) {
				this.fixStacktrace(message.e, page, root);
			}
			dispatch(message);
		});
		await page.route("**/*", (route, request) => {
			const url = request.url();
			if (!url.startsWith(origin)) {
				return route.continue();
			}
			const path = decodeURIComponent(url.slice(origin.length));
			if (path === "/") {
				return route.fulfill(PageHTML);
			}
			const body = readFileSync(join(root, path));
			return route.fulfill({ body, contentType: mime.getType(path)! });
		});

		await page.goto(url);
		await page.evaluate(client, { files, pattern });
		await page.close();
	}

	async execute(options: ExecuteOptions) {
		const page = await this.context.newPage();
		await this.initialize(page, options, "/");
	}

	/**
	 * Convert stack trace to Node format, and resolve location to file URL.
	 */
	fixStacktrace(error: any, page: Page, root: string) {
		const { name, message, stack } = error;
		const { origin } = new URL(page.url());
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
