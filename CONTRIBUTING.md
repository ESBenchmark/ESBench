# Contributing Guide

Thank you for considering contributing to ESBench!

## Setup

The ESBench repo is a monorepo using pnpm workspaces. The package manager used to install and link dependencies must be pnpm.

After cloning and installing, there are a few more steps before you can run it.

A build step is required before running examples and tests:

```shell
pnpm build
```

## Run Tests

```shell
cd core
vitest run
```

## Folder Structure

* core: The package `esbench`
  * Files in the top level of `src/` is used to run suite and parse results, they should be compatibility with browsers.
  * Subfolders of `src/` are modules of the entry point `esbench/host` and the `esbench` CLI.

* docs: Source code of https://esbench.vercel.app, powered by VitePress.

* example: Contains example code.

  * api: Code snippets of [Runner API](https://esbench.vercel.app/api/runner-api)
  * configs: Executor and Builder examples.
  * profilers: Profiler examples.
  * es: Common benchmarks that can be run on all popular runtimes.
  * node: Benchmarks use Node API.
  * web: Benchmarks use browser-specific API.
  * webext: Benchmarks use WebExtension API.
  * misc: Benchmarks need process with special toolchain.
  * self: Performance tests of ESBench's code.

* reporter-html: Source of the HTML reporter, and run its `build` script will generate the HTML template file for `htmlReporter`. 

