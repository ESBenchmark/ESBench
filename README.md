# ESBench

[![NPM Version](https://img.shields.io/npm/v/esbench?style=flat-square)](https://www.npmjs.com/package/esbench)
![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/ESBenchmark/ESBench/test.yml?style=flat-square)
[![Codecov](https://img.shields.io/codecov/c/gh/ESBenchmark/ESBench?style=flat-square)](https://codecov.io/gh/ESBenchmark/ESBench)

A modern JavaScript benchmarking tool.

- **Cross-runtime**: run your benchmark on Node, Bun, browsers, remote devices and more...
- **Parameterization**: provide a series of parameters and see the performance of each combination.
- **Comparable**: support baselines and diff with previous runs.
- **TypeScript Out-of-box**: load your `.ts` files with zero config.
- **HTML Reporter**: plot the results into an interactive chart.
- **Extensible**: support custom profiler, executor, and reporter.
- **IDE Integration**: run suite or case with a click of the mouse, support WebStorm and VSCode.

## Getting Started

Visit [https://esbench.vercel.app](https://esbench.vercel.app) to get started and try ESBench on browser.

## Run Examples

To run examples (files in the `example` folder), you need to build ESBench first:

```shell
pnpm build
```

It is recommended to run one suite at a time using `--file` parameter, as it can take a long time.

```shell
cd example
pnpm exec esbench --filer <filename.js>
```
