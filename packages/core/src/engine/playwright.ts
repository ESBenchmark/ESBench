import { readFileSync } from "fs";
import { join } from "path";
import { Browser, BrowserType, LaunchOptions } from "playwright-core";
import { BenchmarkEngine, RunOptions } from "../host.js";

declare function _ESBenchChannel(message: any): void;

const PageURL = "http://es-bench/";

// noinspection HtmlRequiredLangAttribute,HtmlRequiredTitleElement
const BlankHTML = {
	contentType: "text/html",
	body: "<html><head></head><body></body></html>",
};

async function client({ files, task, entry }: any) {
	const client = await import(entry);
	return client.default(_ESBenchChannel, files, task);
}

export default class PlaywrightEngine implements BenchmarkEngine {

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

	launchContext() {
		return this.browser.newContext();
	}

	async run(options: RunOptions) {
		const { files, task, root, entry, handleMessage } = options;

		const context = await this.launchContext();
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

		await page.close();
		console.log("Evaluate finishd");
	}
}
