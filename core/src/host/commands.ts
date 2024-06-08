import { mkdirSync, readFileSync, rmSync } from "fs";
import { performance } from "perf_hooks";
import { durationFmt } from "@kaciras/utilities/node";
import JobGenerator, { ExecuteOptions } from "./toolchain.js";
import { ESBenchConfig } from "./config.js";
import { ESBenchResult, messageResolver } from "../index.js";
import { resolveRE } from "../utils.js";
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
	const { reporters, toolchains, tempDir, diff, cleanTempDir } = context.config;

	const startTime = performance.now();
	const result: ESBenchResult = {};
	mkdirSync(tempDir, { recursive: true });

	const generator = new JobGenerator(context);
	for (const toolchain of toolchains) {
		generator.add(toolchain);
	}
	await generator.build();
	const jobs = Array.from(generator.getJobs());

	if (jobs.length === 0) {
		return context.warn("\nNo files match the includes, please check your config.");
	}
	const count = jobs.reduce((s, job) => s + job.builds.length, 0);
	context.info(`\nBuild finished, ${count} jobs for ${jobs.length} executors.`);

	for (const { executorName, executor, builds } of jobs) {
		let builder = "";
		context.info(`Running suites with executor "${executorName}"`);

		await executor.start?.();
		try {
			for (const build of builds) {
				builder = build.name;
				context.info(`${build.files.length} suites from builder "${builder}"`);

				const { files, root } = build;
				const { promise, reject, dispatch } = messageResolver(context.logHandler);
				const pattern = resolveRE(context.filter.name).source;

				const input: ExecuteOptions = {
					tempDir,
					pattern,
					files,
					root,
					dispatch,
					reject,
					promise,
				};
				const [records] = await Promise.all([
					input.promise,
					executor.execute(input),
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
			context.error(`Failed to run suite with (builder=${builder}, executor=${executorName})`);
			if (e.name !== "RunSuiteError") {
				throw e;
			}
			context.error(`At scene ${e.paramStr}`);
			throw e.cause;
		} finally {
			await executor.close?.();
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
