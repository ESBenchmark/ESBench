/// <reference types="vite/client" />

declare module "monaco-editor/esm/vs/editor/edcore.main.js" {
	export * from "monaco-editor";
}

declare module "../../example/*.js" {
	import { SuiteInfo } from "./playground/demo-suites.ts";
	export default 0 as unknown as SuiteInfo;
}
