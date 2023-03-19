import { Browser, BrowserType, LaunchOptions } from "playwright-core";
import { BenchmarkRunner, RunOptions } from "./runtime.js";

export { chromium, firefox, webkit } from "playwright-core";

interface BenchmarkRequest {
	file: string;
	name?: string;
}

const PageURL = "http://esbench/";

// noinspection HtmlRequiredLangAttribute,HtmlRequiredTitleElement
const BlankHTML = {
	contentType: "text/html",
	body: "<html><head></head><body></body></html>",
};

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
		const { file, name, importModule, handleMessage } = options;
		console.log("Running benchmark suite: " + file);

		const context = await this.browser.newContext();
		await context.exposeFunction("$SEND_MESSAGE", handleMessage);

		await context.route("**/*", async (route, request) => {
			const path = decodeURIComponent(request.url().slice(PageURL.length - 1));
			if (request.url() === PageURL) {
				return route.fulfill(BlankHTML);
				// } else if (path === "/__esbench_job") {
				// 	return route.fulfill({ json: { file, name } });
			} else {
				return route.fulfill({
					body: await importModule(path),
					contentType: "text/javascript",
				});
			}
		});

		const page = await context.newPage();
		await page.goto(PageURL);
		// await page.addScriptTag({ type: "module", url: "/esbench__loader" });
		await page.evaluate(rtl2, { file, name });

		console.log("Evaluate finishd");
		// page.waitForEvent();
		// await page.close();
	}
}

async function rtl2({ file, name }: BenchmarkRequest) {
	await import("/ESBench_Main.js");
	// const { BenchmarkSuite } = await import("esbench:loader");
	// const { options, build } = (await import(file)).default;
	// await new BenchmarkSuite(options, build, sendBenchmarkMessage).bench(name);
}
