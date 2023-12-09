import { argv, cwd } from "process";
import { isAbsolute, join } from "path";
import { pathToFileURL } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ESBenchHost } from "../lib/index.js";

const parsed = yargs(hideBin(argv))
	.option("file", {
		type: "string",
		description: "Run only benchmark for specified file",
	})
	.option("name", {
		type: "string",
		description: "Run benchmark with names matching the Regex pattern",
	})
	.option("config", {
		type: "string",
		description: "Use specified config file",
	})
	.version(false)
	.strict()
	.parseSync();

let { config = "esbench.config.js", file, name } = parsed;

if (!isAbsolute(config)) {
	config = join(cwd(), config);
}
config = pathToFileURL(config).toString();

const options = (await import(config)).default;

await new ESBenchHost(options).run(file, new RegExp(name));
