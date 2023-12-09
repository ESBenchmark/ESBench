import { argv, cwd } from "process";
import { resolve } from "path";
import { pathToFileURL } from "url";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ESBenchHost } from "./host.js";

process.title = "node (esbench)";

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

const { config = "esbench.config.js", file, name = "" } = parsed;

const resolved = pathToFileURL(resolve(cwd(), config)).toString();
const userConfig = (await import(resolved)).default;

await new ESBenchHost(userConfig).run(file, new RegExp(name));
