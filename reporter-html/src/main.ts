import type { ESBenchResult } from "esbench";
import { createApp } from "vue";
import { Page } from "./index.ts";

declare global {
	interface Window {
		Result: ESBenchResult;
		Previous: ESBenchResult;
	}
}

const app = createApp(Page, {
	result: window.Result,
	previous: window.Previous,
});

app.mount(document.body);
