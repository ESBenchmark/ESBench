import type { EnhanceAppContext } from "vitepress/client";
import Layout from "./Layout.vue";
import "./styles.css";

export default {
	Layout,
	enhanceApp({ app, router, siteData }: EnhanceAppContext) {
		// ...
	}
}
