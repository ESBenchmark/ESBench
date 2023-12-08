import type { ESBenchResult } from "@esbench/core/client";
import { createApp } from "vue";
import "./app.css";
import { Page } from "./index.ts";

declare global {
	interface Window { ESBenchResult: ESBenchResult }
}


createApp(Page, { result: window.ESBenchResult })
	.mount(document.body);
