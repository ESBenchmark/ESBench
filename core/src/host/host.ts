import { mkdirSync, readFileSync, rmSync } from "fs";
import { performance } from "perf_hooks";
import { durationFmt } from "@kaciras/utilities/node";
import JobGenerator, { BuildResult, ExecuteOptions } from "./toolchain.js";
import { ESBenchConfig, normalizeConfig } from "./config.js";
import { ESBenchResult, messageResolver } from "../index.js";
import { consoleLogHandler, resolveRE } from "../utils.js";

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

	const previous = diff && loadJSON(diff, false);
	for (const reporter of reporters) {
		await reporter(result, previous);
	}
}

export async function start(config: ESBenchConfig, filter: FilterOptions = {}) {
	const { reporters, toolchains, tempDir, diff, cleanTempDir } = normalizeConfig(config);
	const result: ESBenchResult = {};
	const startTime = performance.now();

	mkdirSync(tempDir, { recursive: true });

	const generator = new JobGenerator(tempDir, filter);
	for (const toolchain of toolchains) {
		generator.add(toolchain);
	}
	await generator.build();
	const jobs = Array.from(generator.getJobs());

	if (jobs.length === 0) {
		return console.warn("\nNo suite to run, check your CLI parameters.");
	}
	const count = jobs.reduce((s, job) => s + job.builds.length, 0);
	console.log(`\n${count} jobs for ${jobs.length} executors.`);

	for (const { executorName, executor, builds } of jobs) {
		let builder = "";
		console.log(`Running suites with: ${executorName}.`);

		await executor.start?.();
		try {
			for (const build of builds) {
				builder = build.name;

				const context = newExecuteContext(tempDir, build, filter);
				const [tcs] = await Promise.all([
					context.promise,
					executor.execute(context),
				]);

				for (const tc of tcs as any) {
					(result[tc.name] ??= []).push({
						...tc,
						builder,
						executor: executorName,
					});
				}
			}
		} catch (e) {
			console.error(`Failed to run suite with (builder=${builder}, executor=${executorName})`);
			if (e.name !== "RunSuiteError") {
				throw e;
			}
			console.error(`At scene ${e.paramStr}`);
			throw e.cause;
		} finally {
			await executor.close?.();
		}
	}

	console.log(); // Add an empty line between running & reporting phase.

	const previous = diff && loadJSON(diff, false);
	for (const reporter of reporters) {
		await reporter(result, previous);
	}

	/*
	 * We did not put the cleanup code to finally block,
	 * so that you can check the build output when error occurred.
	 */
	if (cleanTempDir) {
		try {
			rmSync(tempDir, { recursive: true });
		} catch (e) {
			console.error(e); // It's ok to keep running.
		}
	}

	const timeUsage = performance.now() - startTime;
	console.log(`Global total time: ${durationFmt.formatMod(timeUsage, "ms")}.`);
}

export function newExecuteContext(tempDir: string, build: BuildResult, filter: FilterOptions) {
	const { files, root } = build;
	const pattern = resolveRE(filter.name).source;
	const { promise, reject, dispatch } = messageResolver(consoleLogHandler);

	return { tempDir, pattern, files, root, dispatch, reject, promise } as ExecuteOptions;
}
