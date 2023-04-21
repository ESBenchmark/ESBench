import { argv, cwd } from "process";
import { isAbsolute, join } from "path";
import { pathToFileURL } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ESBench } from "../src/host.js";

const parsed = yargs(hideBin(argv))
	.option("config", { type: "string" })
	.strict()
	.parseSync();

let { config = "esbench.config.js" } = parsed;

if (!isAbsolute(config)) {
	config = join(cwd(), config);
}
config = pathToFileURL(config).toString();

const options = (await import(config)).default;

await new ESBench(options).run();
