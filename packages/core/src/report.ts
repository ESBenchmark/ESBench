import { stdout } from "process";
import chalk from "chalk";
import envinfo from "envinfo";
import { Table } from "console-table-printer";
import { mean } from "simple-statistics";
import { SuiteResult } from "./runtime.js";

interface ConsoleReporterOptions {
	metrics?: any[];
}

function transpose(names: string[], table: Array<Record<string, any>>) {
	const o: Record<string, any[]> = {};
	for (const name of names) {
		o[name] = [];
	}
	for (const row of table) {
		for (const name of names) {
			o[name].push(row[name]);
		}
	}
	return o;
}

function reportSuite(result: SuiteResult) {
	stdout.write(chalk.yellowBright("\nSuite: "));
	console.log(result.file);

	const names = Object.keys(result.metrics);

	for (const platform of result.runners) {
		for (const case_ of platform.cases) {
			stdout.write(chalk.yellowBright("\nParams: "));
			console.log(JSON.stringify(case_.params));
			const table  = new Table();

			for (const [bench, records] of Object.entries(case_.iterations)) {
				const rows = transpose(names, records);

				const tableRow: Record<string, string> = { bench };
				for (const [column, values] of Object.entries(rows)) {
					tableRow[column] = mean(values) + " " + result.metrics[column].unit;
				}

				table.addRow(tableRow);
			}

			table.printTable();
		}
	}
}

export default function consoleReporter(options: ConsoleReporterOptions = {}) {

	return async (results: SuiteResult[]) => {
		stdout.write(chalk.blueBright("OS: "));
		console.log((await envinfo.helpers.getOSInfo())[1]);

		stdout.write(chalk.blueBright("CPU: "));
		console.log((await envinfo.helpers.getCPUInfo())[1]);

		stdout.write(chalk.blueBright("Memory: "));
		console.log((await envinfo.helpers.getMemoryInfo())[1]);

		for (const result of results) reportSuite(result);
	};
}
