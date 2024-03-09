import type { ESBenchResult } from "esbench";
import { createApp } from "vue";
import App from "./App.vue";

declare global {
	interface Window {
		Result: ESBenchResult;
		Previous: ESBenchResult;
	}
}

const app = createApp(App, {
	result: window.Result,
	previous: window.Previous,
});

app.mount(document.body);
