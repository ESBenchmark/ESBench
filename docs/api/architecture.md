# Architecture

Benchmarking, which is testing the performance of code under a certain scenario, a benchmarking tool actually solves 3 problems: **how to generate scenarios, how to measure metrics, and how to report.**

## Scenarios

For the first problem, ESBench uses a multi-level nested execution flow:

1. ESBench supports run multiple times with [different tags](../guide/cli#cross-os-benchmark), the results can be merged into single report.
2. In each run, ESBench uses [builders](../guide/toolchains#builder) to generate outputs for a suite.
3. Then use [executors](../guide/toolchains) to execute each build output in different platform.
4. In suite, we can define a series of [parameters](../guide/parameterization), each combination create a scene and call the `setup` function.
5. In the `setup`, we can add [benchmark cases](../guide/suites#define-suite) that we want to measure performance of.

They can all affect the performance of the use case, and to keep track of them, **ESBench is able to add each step as a variable, e.g., cases built with `ViteBuilder` have variable `builder: "Vite"`, each scenario can be represented as a combination of variables.**

The design emulates the real-world building process as closely as possible and allows users to write benchmark cases in the easiest way. Step 3 crosses the process boundary, so ESBench needs to be divided into two parts:

* The host (exported as `esbench/host`) has CLI, [Builder](./builder), [Executor](./executor), and [Reporter](../guide/reporters). It is only usable from Node.js and other runtimes that compatible with Node API.

* The client (exported as `esbench`) contains functions to run suites, and tools to deal with the results. It uses ES6 and a few Web APIs, compatibility with browsers and most server-side runtimes.

## Host Plugins

On the host side, ESBench builds suites, calls executors, and collects the results for reporting. Each step can be customized by the plugin.

One thing to consider in designing the API here is what form the builder's output should be saved in, and how the executor can access it.

**ESBench chose files as the bridge between the builder and the executor** because it is the most generalized model: all server-side runtimes are capable of running JS files, browser and remote execution are easily supported by setting up a simple file server.

## Measurement

Once we have the use cases, the next step is to measure the various metrics, this part is left to the plugin - [Profiler](./profiler).

Profiler runs on the client side, it is allowed to directly access the use cases and add metrics to them. Finally this data will be transferred to the host side and used to generate reports.

## Tabular Data

We ended up collecting benchmark cases, and metrics for each case, which is a two-dimensional (or tabular) data that can be exported as tables, charts, and other forms of reports, and this part was given to the [Reporter](../guide/reporters) to do.

ESBench recommends assigning raw data to the metrics, such as samples array instead of their averages, and these conversions are given to the reporter. This design allows the reporter to get more information and do its statistical analysis to each metric.
