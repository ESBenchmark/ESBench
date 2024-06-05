# Contributing Guide

Thank you for considering contributing to ESBench!

## Setup

The ESBench repo is a monorepo using pnpm workspaces. The package manager used to install and link dependencies must be pnpm.

After cloning and installing, there are a few more steps before you can run it.

A build step is required before running examples and tests:

```shell
pnpm --filter ./core build
```

If you're going to use `htmlReporter`, you need to build the HTML template first:

```shell
pnpm --filter ./reporter-html build
```

## Folder Structure

* core: The package `esbench`
  * Files in `src/` (not includes its subfolder) is used to run suite and parse results, they should be compatibility with browsers.
  * Subfolders of `src/` are modules of the entry point `esbench/host` and the `esbench` CLI.

* docs: Source code of https://esbench.vercel.app

* example: Contains example codes.

* reporter-html: Source of the HTML page used by playground, and run its `build` script will generate the HTML template file for `htmlReporter`. 

