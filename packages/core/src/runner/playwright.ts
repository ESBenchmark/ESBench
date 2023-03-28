import { readFileSync } from "fs";
import { join } from "path";
import { Browser, BrowserType, LaunchOptions } from "playwright-core";
import { BenchmarkRunner, RunOptions } from "../runtime.js";

export { chromium, firefox, webkit } from "playwright-core";

declare function _ESBenchChannel(message: any): void;

const PageURL = "http://esbench/";

// noinspection HtmlRequiredLangAttribute,HtmlRequiredTitleElement
const BlankHTML = {
	contentType: "text/html",
	body: "<html><head></head><body></body></html>",
};

async function client({ files, task, entry }: any) {
	const mod = await import(entry);
	for (const file of files)
		await mod.default(file, task, _ESBenchChannel);
}

export class PlaywrightRunner implements BenchmarkRunner {

	private readonly type: BrowserType;
	private readonly options: LaunchOptions;

	private browser!: Browser;

	constructor(type: BrowserType, options: LaunchOptions) {
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

	async run(options: RunOptions) {
		const { files, task, root, entry, handleMessage } = options;

		const context = await this.browser.newContext();
		await context.exposeFunction("_ESBenchChannel", handleMessage);

		await context.route("**/*", (route, request) => {
			if (request.url() === PageURL) {
				return route.fulfill(BlankHTML);
			}
			const path = decodeURIComponent(request.url().slice(PageURL.length - 1));
			const body = readFileSync(join(root, path));
			return route.fulfill({ body, contentType: "text/javascript" });
		});

		const page = await context.newPage();
		await page.goto(PageURL);
		await page.evaluate(client, { files, task, entry });

		console.log("Evaluate finishd");
		await page.close();
	}
}
