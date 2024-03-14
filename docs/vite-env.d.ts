/// <reference types="vite/client" />

declare module "../../example/*.js" {
	import { SuiteInfo } from "./playground/demo-suites.ts";
	export default 0 as unknown as SuiteInfo;
}
