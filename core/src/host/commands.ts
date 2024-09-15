import { createWriteStream, mkdirSync, readFileSync, rmSync, WriteStream } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { once } from "node:events";
import { durationFmt } from "@kaciras/utilities/node";
import glob from "fast-glob";
import JobGenerator, { BuildResult, Job } from "./toolchain.js";
import { ESBenchConfig } from "./config.js";
import { ESBenchResult, messageResolver, ToolchainResult } from "../connect.js";
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

export async function report(config: ESBenchConfig, patterns: string[]) {
	const context = new HostContext(config);
	const files = glob.sync(patterns);

	if (files.length === 0) {
		throw new Error("No file match the glob patterns.");
	}

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

/**
 * When there are a large number of complex benchmarking cases,
 * the result set can be large, causing the memory footprint to keep increasing,
 * affecting GC and thus spoiling the results.
 *
 * So we write results to a file, and read back after execution phase finished.
 */
class JsonResultWriter {

	private readonly fp: WriteStream;

	private addDot = false;
	private drained = true;

	constructor(path: string) {
		this.fp = createWriteStream(path, "utf8");
		this.fp.write("[");
	}

	async addSuiteResult(value: ToolchainResult) {
		// Ensure the buffer flushed.
		if(!this.drained) {
			await once(this.fp, "drain");
		}
		if (this.addDot) {
			this.fp.write(",");
		}
		this.addDot = true;
		const data = JSON.stringify(value);
		this.drained = this.fp.write(data);
	}

	async finish() {
		this.fp.write("]");
		await promisify(this.fp.close.bind(this.fp))();
		const json = readFileSync(this.fp.path, "utf8");

		const grouped = Object.create(null);
		for(const record of JSON.parse(json)) {
			(grouped[record.name] ??= []).push(record);
		}
		return grouped as ESBenchResult;
	}
}

export async function start(config: ESBenchConfig, filter?: FilterOptions) {
	const context = new HostContext(config, filter);
	const { reporters, tempDir, diff, cleanTempDir } = context.config;

	const startTime = performance.now();
	mkdirSync(tempDir, { recursive: true });

	// 1) Collect suites, invoke toolchains.
	const jobs = await JobGenerator.generate(context);
	if (jobs.length === 0) {
		return context.warn("\nNo file match the includes, please check your config.");
	}
	const count = jobs.reduce((s, job) => s + job.builds.length, 0);
	context.info(`\nBuild finished, ${count} jobs for ${jobs.length} executors.`);

	// 2) Execute benchmark suites.
	const writer = new JsonResultWriter(join(tempDir, "result-buffer.json"));
	for (const job of jobs) {
		await runJob(context, job, writer);
	}

	// 3) Export the results.
	const result = await writer.finish();
	if (diff) {
		context.previous = loadResults(diff, false) ?? {};
	}
	context.info(/* Add an empty line */);
	for (const reporter of reporters) {
		await reporter(result, context);
	}

	/*
	 * 4) Cleanup. We did not put the code into finally block,
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

async function runJob(context: HostContext, job: Job, writer: JsonResultWriter) {
	const { executor, builds } = job;

	context.info(`Running suites with executor "${job.name}"`);
	let build: BuildResult;

	await executor.start?.(context);
	try {
		for (build of builds) {
			context.info(`${build.files.length} suites from builder "${build.name}"`);

			for (const file of build.files) {
				const resolver = messageResolver(context.logHandler);

				const execution = executor.execute({
					...resolver,
					file: file,
					root: build.root,
					pattern: context.filter.name.source,
				});

				const [record] = await Promise.all([
					resolver.promise,
					execution,
				]);
				await writer.addSuiteResult({
					...record,
					executor: job.name,
					builder: build.name,
					tags: context.config.tags,
				});
			}
		}
	} finally {
		await executor.close?.(context);
	}
}
