import { globSync, readFileSync } from "fs";
import { join } from "path";
import { pathToFileURL } from "url";
import { defineSuite } from "esbench";
import { load, typeCache } from "../../core/src/host/loader.ts";

const root = join(import.meta.dirname, "../../core");

const urls = globSync("src/**/*.ts", { cwd: root })
	.map(f => pathToFileURL(join(root, f)).toString());

function nextLoad(url: string) {
	return { source: readFileSync(url.slice(8)) } as any;
}

export default defineSuite(scene => {
	scene.benchAsync("load", () => {
		typeCache.clear();
		return Promise.all(urls.map(url => load(url, {} as any, nextLoad)));
	});
});
