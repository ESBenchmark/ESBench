import type { ESBenchResult } from "@esbench/core/client";
import "./app.css";
import { Page } from "./index.ts";

declare global {
	interface Window { ESBenchResult: ESBenchResult }
}

export default new Page({
	target: document.body,
	props: { result: window.ESBenchResult },
});
