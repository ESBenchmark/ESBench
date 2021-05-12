import * as playwright from "playwright";
import Koa, { Middleware } from "koa";
import { AddressInfo } from "net";

export async function run() {
	const browser = await playwright["firefox"].launch({
		executablePath: "D:/Program Files/Mozilla Firefox/firefox.exe",
	});
	const context = await browser.newContext();
	const page = await context.newPage();
	await page.goto("http://www.v2ex.com/");
	await page.screenshot({ path: "example-firefox.png" });
	await browser.close();
}

export default class PlaywrightRunner {


}