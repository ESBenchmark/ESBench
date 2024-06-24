# Introduction

ESBench is a modern JavaScript benchmarking tool.

- **Cross-runtime**: run your benchmark on Node, Bun, browsers, remote devices and more...
- **Parameterization**: provide a series of parameters and see the performance of each combination.
- **Comparable**: support baselines and diff with previous runs.
- **TypeScript Out-of-box**: load your `.ts` files with zero config.
- **HTML Reporter**: plot the results into an interactive chart.
- **Extensible**: support custom profiler, executor, and reporter.
- **IDE Integration**: run specific suite or case with a click of the mouse, support WebStorm and VSCode.

## Why ESBench

### Cross Runtime

One difference between JavaScript and other languages is that it has no official interpreter. Browsers, Node, and the new Deno and bun are all possible target platforms, and the performance of the code on different platforms is a worthwhile question.

**ESBench aims to run your benchmarks on various runtimes** and let you know comprehensive and reliable results. help you choose the best environment for scaling your application.

### Benchmark without the hassle

ESBench includes a rich set of features and hides implementation details. It allows you to write benchmarks in the simplest way - no harder than writing unit tests!
