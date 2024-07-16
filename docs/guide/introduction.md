# Introduction

ESBench is a modern JavaScript benchmarking tool.

- **Cross-runtime**: run your benchmark on Node, Bun, browsers, remote devices and more...
- **Parameterization**: provide a series of parameters and see the performance of each combination.
- **Comparison**: support baselines and diff with previous runs.
- **TypeScript Out-of-box**: run your `.ts` files with zero config.
- **HTML Reporter**: plot the results into an interactive chart.
- **Extensible**: support custom profiler, executor, and reporter.
- **IDE Integration**: run specific suite or case with a click of the mouse, support WebStorm and VSCode.

## Why ESBench

### Cross Runtime

![Runtimes](../assets/runtimes.webp)

One difference between JavaScript and other languages is that it has no official interpreter. Browsers, Node, the new Deno, and bun are all possible target platforms, all of them use performance as a selling point and provide some examples of benchmarking. But real-world situations won't be the same as the examples, to find out how they perform on your own project, you'll always need to test them yourself.

**ESBench aims to run your benchmarks on various platforms** and let you know comprehensive and reliable results. help you choose the best environment for scaling your application.

### Benchmark without the hassle

![Runtimes](../assets/suite-and-config.webp)

ESBench includes a rich set of benchmarking features and integrates with popular tools that can be used with a simple declaration. ESBench hides the details of their implementation, allows you to write benchmarks in the simplest way - no harder than writing unit tests!

If that's not enough, ESBench also supports extensions - it's plug-in architecture.

### Lightweight

At only 202 KB (minified, including dependencies), ESBench is a thoroughly lightweight library.
