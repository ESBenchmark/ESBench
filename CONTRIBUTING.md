# Contributing Guide

Thank you for considering contributing to ESBench!

## Setup

The ESBench repo is a monorepo using pnpm workspaces. The package manager used to install and link dependencies must be pnpm.

After cloning and installing, there are a few more steps before you can run it.

A build step is required before running examples and tests:

```shell
pnpm --filter ./core build
```

If you're going to use `htmlReporter`, you need to build it first to generate the single file HTML:

```shell
pnpm --filter ./reporter-html build
```
