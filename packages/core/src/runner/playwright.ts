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

async function runBenchmarks({ files, name, entry }: any) {
	const mod = await import(entry);
	for (const file of files)
		await mod.default(file, name, _ESBenchChannel);
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
		console.log("Launching browser...");
		this.browser = await this.type.launch(this.options);
	}

	close() {
		return this.browser.close();
	}

	async run(options: RunOptions) {
		const { files, name, root, entry, handleMessage } = options;
		// console.log("Running benchmark suite: " + file);

		const context = await this.browser.newContext();
		await context.exposeFunction("_ESBenchChannel", handleMessage);

		await context.route("**/*", async (route, request) => {
			if (request.url() === PageURL) {
				return route.fulfill(BlankHTML);
			}
			const path = decodeURIComponent(request.url().slice(PageURL.length - 1));
			const body = importModule(root, path);
			return route.fulfill({ body, contentType: "text/javascript" });
		});

		const page = await context.newPage();
		await page.goto(PageURL);
		await page.evaluate(runBenchmarks, { files, name, entry });

		console.log("Evaluate finishd");
		// page.waitForEvent();
		await page.close();
	}
}

function importModule(root: string, path: string) {
	return readFileSync(join(root, path));
}
