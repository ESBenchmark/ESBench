# Architecture

Benchmarking, which is testing the performance of code under a certain scenario, a benchmarking tool actually solves two problems: **how to generate scenarios, and how to measure metrics.**

## Scenarios

For the first problem, ESBench uses a multi-level nested execution flow:

1. ESBench supports run multiple times with different tags, the results can be merged into single report.
2. In each run, ESBench uses builders to generate outputs for a suite.
3. Then use executors to execute each build output in different platform.
4. In suite, we can define a series of parameters, each combination create a scene and call the `setup` function.
5. In the `setup`, we can add benchmark cases that we want to measure performance of. 

The design emulates the real-world building process as closely as possible and allows users to write benchmark cases in the easiest way. Step 3 crosses the process boundary, so ESBench needs to be divided into two parts:

* The host (exported as `esbench/host`) has CLI, executors, builders, and reporters. It is only usable from Node.js and other runtimes that compatible with Node API.

* The client (exported as `esbench`) contains functions to run suites, and tools to deal with the results. It uses ES6 and a few Web APIs, compatibility with browsers and most server-side runtimes.

## Measurement


__
## Tabular Data

