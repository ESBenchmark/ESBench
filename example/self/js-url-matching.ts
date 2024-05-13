import { defineSuite } from "esbench";

const url = "file:/usr/local/projects/javascript/esbench/core/node_modules/.pnpm/monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js";

const jsFileRE = /^(?:file:|\.{1,2}\/).+\.([cm]?jsx?)$/i;

export default defineSuite(scene => {
	scene.bench("regexp + startWith", () => {
		const isFile = url.startsWith("file:") || /^\.{1,2}\//.test(url);
		return isFile && /\.([cm]?jsx?)$/i.test(url);
	});
	scene.bench("single regexp", () => jsFileRE.test(url));
});
