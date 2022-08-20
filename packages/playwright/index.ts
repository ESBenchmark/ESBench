import { Browser, BrowserType, LaunchOptions } from "playwright-core";
import { BenchmarkRunner, RunOptions } from "@esbench/core/lib/runtime.js";

export { chromium, firefox, webkit } from "playwright-core";

declare function sendBenchmarkMessage(message: any): void;

interface BenchmarkRequest {
	file: string;
	name?: string;
}

async function runBenchmarks({ file, name }: BenchmarkRequest) {
	const { BenchmarkSuite } = await import("@esbench/core/lib/core.js");
	const { options, build } = (await import(file)).default;

	await new BenchmarkSuite(options, build, sendBenchmarkMessage).bench(name);
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
		const { file, name, importModule, handleMessage } = options;
		console.log("Running benchmark suite: " + file);

		const context = await this.browser.newContext();
		await context.exposeFunction("sendBenchmarkMessage", handleMessage);

		await context.route("core.js", (route, request) => {
			route.fulfill({
				body: importModule(request.url()),
				contentType: "text/javascript",
			});
		});

		const page = await context.newPage();
		await page.evaluate(runBenchmarks, { file, name });
	}
}
