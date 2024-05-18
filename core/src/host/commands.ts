import { mkdirSync, readFileSync, rmSync } from "fs";
import { performance } from "perf_hooks";
import { durationFmt } from "@kaciras/utilities/node";
import JobGenerator, { ExecuteOptions } from "./toolchain.js";
import { ESBenchConfig, normalizeConfig } from "./config.js";
import { ESBenchResult, messageResolver } from "../index.js";
import { resolveRE } from "../utils.js";
import { createLogger } from "./logger.js";

export interface FilterOptions {
	file?: string;
	builder?: string | RegExp;
	executor?: string | RegExp;
	name?: string | RegExp;
	shared?: string;
}

function loadJSON(path: string, throwIfMissing: boolean) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (e) {
		if (throwIfMissing || e.code !== "ENOENT") throw e;
	}
}

export async function report(config: ESBenchConfig, files: string[]) {
	const { reporters, diff } = normalizeConfig(config);

	const result = loadJSON(files[0], true) as ESBenchResult;

	for (let i = 1; i < files.length; i++) {
		const more = loadJSON(files[i], true) as ESBenchResult;
		for (const [name, suite] of Object.entries(more)) {
			(result[name] ??= []).push(...suite);
		}
	}

	const previous = diff && loadJSON(diff, false) || {};
	for (const reporter of reporters) {
		await reporter(result, previous);
	}
}

export async function start(config: ESBenchConfig, filter: FilterOptions = {}) {
	const { reporters, toolchains, tempDir, diff, cleanTempDir, logLevel } = normalizeConfig(config);
	const startTime = performance.now();

	const logger = createLogger(logLevel);
	const result: ESBenchResult = {};
	mkdirSync(tempDir, { recursive: true });

	const generator = new JobGenerator(tempDir, filter, logger);
	for (const toolchain of toolchains) {
		generator.add(toolchain);
	}
	await generator.build();
	const jobs = Array.from(generator.getJobs());

	if (jobs.length === 0) {
		return logger.warn("\nNo files match the includes, please check your config.");
	}
	const count = jobs.reduce((s, job) => s + job.builds.length, 0);
	logger.info(`\nBuild finished, ${count} jobs for ${jobs.length} executors.`);

	for (const { executorName, executor, builds } of jobs) {
		let builder = "";
		logger.info(`Running suites with executor "${executorName}"`);

		await executor.start?.();
		try {
			for (const build of builds) {
				builder = build.name;
				logger.info(`${build.files.length} suites from builder "${builder}"`);

				const { files, root } = build;
				const { promise, reject, dispatch } = messageResolver(logger.handler);
				const pattern = resolveRE(filter.name).source;

				const context: ExecuteOptions = {
					tempDir,
					pattern,
					files,
					root,
					dispatch,
					reject,
					promise,
				};
				const [records] = await Promise.all([
					context.promise,
					executor.execute(context),
				]);

				for (let i = 0; i < records.length; i++) {
					let file = build.files[i];
					if (file.startsWith("./")) {
						file = file.slice(2);
					}
					(result[file] ??= []).push({
						...records[i],
						builder,
						executor: executorName,
					});
				}
			}
		} catch (e) {
			logger.error(`Failed to run suite with (builder=${builder}, executor=${executorName})`);
			if (e.name !== "RunSuiteError") {
				throw e;
			}
			logger.error(`At scene ${e.paramStr}`);
			throw e.cause;
		} finally {
			await executor.close?.();
		}
	}

	logger.info(); // Add an empty line between running & reporting phase.

	const previous = diff && loadJSON(diff, false) || {};
	for (const reporter of reporters) {
		await reporter(result, previous);
	}

	/*
	 * We did not put the cleanup code into finally block,
	 * so that user can check the build output when error occurred.
	 */
	if (cleanTempDir) {
		try {
			rmSync(tempDir, { recursive: true });
		} catch (e) {
			logger.error(e);
		}
	}

	const timeUsage = performance.now() - startTime;
	logger.info(`Global total time: ${durationFmt.formatMod(timeUsage, "ms")}.`);
}
