import { readFileSync } from "fs";
import { join } from "path";
import { Browser, BrowserType, LaunchOptions } from "playwright-core";
import mime from "mime";
import { BenchmarkEngine, RunOptions } from "../stage.js";

declare function _ESBenchChannel(message: any): void;

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

export default class PlaywrightEngine implements BenchmarkEngine {

	private readonly type: BrowserType;
	private readonly options?: LaunchOptions;

	private browser!: Browser;

	constructor(type: BrowserType, options?: LaunchOptions) {
		this.type = type;
		this.options = options;
	}

	async start() {
		const { type, options } = this;
		this.browser = await type.launch(options);

		console.log("Launching browser...");
		return `${type.name()} - ${this.browser.version()}`;
	}

	close() {
		return this.browser.close();
	}

	launchContext() {
		return this.browser.newContext({ baseURL });
	}

	async run(options: RunOptions) {
		const { files, pattern, root, handleMessage } = options;

		const context = await this.launchContext();
		await context.exposeFunction("_ESBenchChannel", handleMessage);

		await context.route("**/*", (route, request) => {
			const url = request.url();
			if (url === baseURL) {
				return route.fulfill(PageHTML);
			}
			const path = decodeURIComponent(url.slice(baseURL.length - 1));
			const body = readFileSync(join(root, path));
			return route.fulfill({ body, contentType: mime.getType(path)! });
		});

		const page = await context.newPage();
		await page.goto("/");
		await page.evaluate(client, { files, pattern });

		await page.close();
		await context.close();
	}
}
