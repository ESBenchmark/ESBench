import { mkdirSync, readFileSync, rmSync } from "fs";
import { performance } from "perf_hooks";
import { durationFmt } from "@kaciras/utilities/node";
import JobGenerator, { ExecuteOptions } from "./toolchain.js";
import { ESBenchConfig } from "./config.js";
import { ESBenchResult, messageResolver } from "../index.js";
import { FilterOptions, HostContext } from "./context.js";

function loadResults(path: string, throwIfMissing: true): ESBenchResult;

function loadResults(path: string, throwIfMissing: false): ESBenchResult | undefined;

function loadResults(path: string, throwIfMissing: boolean) {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as ESBenchResult;
	} catch (e) {
		if (throwIfMissing || e.code !== "ENOENT") throw e;
	}
}

export async function report(config: ESBenchConfig, files: string[]) {
	const context = new HostContext(config);

	const { reporters, diff } = context.config;
	const result = loadResults(files[0], true);

	for (let i = 1; i < files.length; i++) {
		const more = loadResults(files[i], true);
		for (const [name, suite] of Object.entries(more)) {
			(result[name] ??= []).push(...suite);
		}
	}

	if (diff) {
		context.previous = loadResults(diff, false) ?? {};
	}
	for (const reporter of reporters) {
		await reporter(result, context);
	}
}

export async function start(config: ESBenchConfig, filter?: FilterOptions) {
	const context = new HostContext(config, filter);
	const { reporters, tempDir, diff, cleanTempDir } = context.config;

	const startTime = performance.now();
	const result: ESBenchResult = {};
	mkdirSync(tempDir, { recursive: true });

	const jobs = await JobGenerator.generate(context);

	if (jobs.length === 0) {
		return context.warn("\nNo files match the includes, please check your config.");
	}
	const count = jobs.reduce((s, job) => s + job.builds.length, 0);
	context.info(`\nBuild finished, ${count} jobs for ${jobs.length} executors.`);

	for (const { executorName, executor, builds } of jobs) {
		let builder = "";
		context.info(`Running suites with executor "${executorName}"`);

		await executor.start?.(context);
		try {
			for (const build of builds) {
				builder = build.name;
				context.info(`${build.files.length} suites from builder "${builder}"`);

				for (const file of build.files) {
					const { promise, reject, dispatch } = messageResolver(context.logHandler);
					const pattern = context.filter.name.source;

					const input: ExecuteOptions = {
						tempDir,
						pattern,
						file,
						root: build.root,
						dispatch,
						reject,
						promise,
					};

					const [record] = await Promise.all([
						input.promise,
						executor.execute(input),
					]);
					(result[record.name!] ??= []).push({
						...record,
						builder,
						executor: executorName,
					});
				}
			}
		} catch (e) {
			context.error(`Failed to run suite with (builder=${builder}, executor=${executorName})`);
			if (e.name !== "RunSuiteError") {
				throw e;
			}
			context.error(`At scene ${e.paramStr}`);
			throw e.cause;
		} finally {
			await executor.close?.(context);
		}
	}

	context.info(); // Add an empty line between running & reporting phase.

	if (diff) {
		context.previous = loadResults(diff, false) ?? {};
	}
	for (const reporter of reporters) {
		await reporter(result, context);
	}

	/*
	 * We did not put the cleanup code into finally block,
	 * so that user can check the build output when error occurred.
	 */
	if (cleanTempDir) {
		try {
			rmSync(tempDir, { recursive: true });
		} catch (e) {
			context.error(e);
		}
	}

	const timeUsage = performance.now() - startTime;
	context.info(`Global total time: ${durationFmt.formatMod(timeUsage, "ms")}.`);
}
