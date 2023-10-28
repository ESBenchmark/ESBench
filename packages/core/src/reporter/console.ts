import { stdout } from "process";
import chalk from "chalk";
import envinfo from "envinfo";
import { StageResult } from "../client/collect.js";
import { Reporter } from "../config.js";

interface ConsoleReporterOptions {
	metrics?: any[];
}

function reportSuite(results: StageResult[], options: ConsoleReporterOptions) {

}

export default function (options: ConsoleReporterOptions = {}): Reporter {
	return async result => {
		stdout.write(chalk.blueBright("OS: "));
		console.log((await envinfo.helpers.getOSInfo())[1]);

		stdout.write(chalk.blueBright("CPU: "));
		console.log((await envinfo.helpers.getCPUInfo())[1]);

		stdout.write(chalk.blueBright("Memory: "));
		console.log((await envinfo.helpers.getMemoryInfo())[1]);

		for (const [name, stages] of Object.entries(result)) {
			stdout.write(chalk.yellowBright("\nSuite: "));
			console.log(name);
			reportSuite(stages, options);
		}
	};
}
