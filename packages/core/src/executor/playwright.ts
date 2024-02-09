import type { Browser, BrowserContext, BrowserType, LaunchOptions, Page } from "playwright-core";
import { readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import mime from "mime";
import { Executor, RunOptions } from "../host/toolchain.js";
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
	const connect = await import("./index.js");
	return connect.default(_ESBenchChannel, files, pattern);
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

	private readonly type: BrowserType;
	private readonly options?: LaunchOptions;

	readonly name: string;

	private browser!: Browser;
	private context!: BrowserContext;

	constructor(type: BrowserType, options?: LaunchOptions) {
		this.name = type.name();
		this.type = type;
		this.options = options;
	}

	async start() {
		const { type, options } = this;
		console.log("[Playwright] Launching browser...");
		this.browser = await type.launch(options);
		this.context = await this.browser.newContext({ baseURL });
	}

	close() {
		return this.browser.close();
	}

	fixStacktrace(error: any, page: Page, root: string) {
		const { name, message, stack } = error;
		const { origin } = new URL(page.url());
		const lines = stack.split("\n") as string[];
		let re: RegExp;

		if (this.type.name() !== "chromium") {
			re = /(.*?)@(.+)/;
		} else {
			lines.splice(0, 1);
			re = / {4}at (.+?) \((.+?)\)/;
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

	async run(options: RunOptions) {
		const { files, pattern, root, handleMessage } = options;
		const page = await this.context.newPage();

		const channel = (message: ClientMessage) => {
			if ("e" in message) {
				this.fixStacktrace(message.e, page, root);
			}
			handleMessage(message);
		};

		await page.exposeFunction("_ESBenchChannel", channel);

		await page.route("**/*", (route, request) => {
			const url = request.url();
			if (url === baseURL) {
				return route.fulfill(PageHTML);
			}
			const path = decodeURIComponent(url.slice(baseURL.length - 1));
			const body = readFileSync(join(root, path));
			return route.fulfill({ body, contentType: mime.getType(path)! });
		});

		await page.goto("/");
		await page.evaluate(client, { files, pattern });
		await page.close();
	}
}
