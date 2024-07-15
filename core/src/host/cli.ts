import nodeModule from "node:module";
import process from "node:process";
import { importCWD } from "@kaciras/utilities/node";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { report, start } from "./commands.js";

const DEFAULT_CONFIG_FILE = "esbench.config.js";

process.title = "node (esbench)";

const program = yargs(hideBin(process.argv))
	.command("report <patterns...>", "Generate report from result files", {
		config: {
			type: "string",
			description: "Use specified config file",
		},
		loader: {
			type: "boolean",
			description: "Enable builtin TypeScript loader hooks",
			default: true,
		},
		patterns: {
			type: "string",
			description: "Glob patterns for files to load",
			array: true,
			demandOption: true,
		},
	}, async args => {
		const { config, patterns } = args;
		if (args.loader) {
			nodeModule.register?.("ts-directly", import.meta.url);
		}
		const cfgObj = await importCWD(config, [DEFAULT_CONFIG_FILE]);
		return report(cfgObj ?? {}, patterns);
	})
	.command("*", "Run benchmark", {
		config: {
			type: "string",
			description: "Use specified config file",
		},
		loader: {
			type: "boolean",
			description: "Enable builtin TypeScript loader hooks",
			default: true,
		},
		logLevel: {
			type: "string",
			description: "Log level (debug | info | warn | error | off)",
		},
		tag: {
			type: "string",
			array: true,
			description: "Add variables to the results",
		},
		file: {
			type: "string",
			description: "Run only suites that contains the value in their paths",
		},
		builder: {
			type: "string",
			description: "Run only suites built with the specified builder which name matching the Regex pattern",
		},
		executor: {
			type: "string",
			description: "Run only suites executed with the specified executor which name matching the Regex pattern",
		},
		name: {
			type: "string",
			description: "Run benchmark with names matching the Regex pattern",
		},
		shared: {
			type: "string",
			description: "Execute suites in a specified shard",
		},
	}, async args => {
		const { config, logLevel, tag, ...filter } = args;
		if (args.loader) {
			nodeModule.register?.("ts-directly", import.meta.url);
		}
		let cfgObj = await importCWD(config, [DEFAULT_CONFIG_FILE]);
		cfgObj ??= {};

		if (logLevel) {
			cfgObj.logLevel = logLevel;
		}

		if (tag) {
			cfgObj.tags ??= {};
			tag.map(i => i.split(":", 2))
				.forEach(([k, v]) => cfgObj.tags[k] = v);
		}

		return start(cfgObj, filter);
	});


program.version(false).strict().showHelpOnFail(false).parseAsync();
