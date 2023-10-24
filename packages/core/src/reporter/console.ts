import { stdout } from "process";
import chalk from "chalk";
import envinfo from "envinfo";
import { Reporter } from "../config.js";
import { SceneResult } from "../client/collect.js";

interface ConsoleReporterOptions {
	metrics?: any[];
}

// suite -> stage -> scene -> case
function reportSuite(results: SceneResult[], options: ConsoleReporterOptions) {
	// TODO
}

export default function (options: ConsoleReporterOptions = {}): Reporter {
	return async results => {
		stdout.write(chalk.blueBright("OS: "));
		console.log((await envinfo.helpers.getOSInfo())[1]);

		stdout.write(chalk.blueBright("CPU: "));
		console.log((await envinfo.helpers.getCPUInfo())[1]);

		stdout.write(chalk.blueBright("Memory: "));
		console.log((await envinfo.helpers.getMemoryInfo())[1]);

		for (const [file, scenes] of Object.entries(results)) {
			stdout.write(chalk.yellowBright("\nSuite: "));
			console.log(file);
			reportSuite(scenes, options);
		}
	};
}
