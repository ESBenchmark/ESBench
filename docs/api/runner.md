# JavaScript API

The `esbench` package exports 2 entry points:

* `esbench` Contains functions to run suites, and tools to deal with the results. It uses ES6 and a few Web APIs, compatibility with browsers and most server-side runtimes.
  
* `esbench/host` Has CLI, executors, builders, and reporters. It is only usable from Node.js or other runtimes that compatible with Node API.

## Run Suites

```javascript
import { buildSummaryTable, defineSuite, runSuite } from "esbench";

const suite = defineSuite(scene => {
	const template = Array.from({ length: 1000 }, () => Math.random());
	let array = [];

	scene.beforeIteration(() => array = template.slice());
	scene.bench("builtin", () => array.sort((a, b) => a - b));
});

const result = await runSuite(suite);

// Convert the result to a table
const summaryTable = buildSummaryTable([result]);

// Print the table
console.log("\n" + summaryTable.format().toMarkdown());
if (summaryTable.hints.length > 0) {
	console.log("Hints:");
	summaryTable.hints.forEach(n => console.log(n));
}
if (summaryTable.warnings.length > 0) {
	console.log("Warnings:");
	summaryTable.warnings.forEach(n => console.log(n));
}
```

## Parse Results

The return value of `runSuite` is intended to be a serialized structure, and it is recommended to use `Summary` to parse it instead of using it directly.

```javascript
import { Summary, runSuite } from "esbench";

const results = runSuite(/* ... */);

// ESBench provide a helper `Summary` to parse results of runSuite.
const summary = new Summary([results]);

console.log("Variables:", summary.vars);
console.log("Metric Descriptions:", summary.meta);

console.log("Case Results:");
for (let i = 0; i < summary.results.length; i++) {
	const result = summary.results[i];
	const metrics = Summary.getMetrics(result);

	console.log(`${i}.`.padEnd(3), JSON.stringify(result));
	console.log("   ", JSON.stringify(metrics));
}

// Get the metrics of specific case.
Summary.getMetrics(summary.find({
	Name: "object",
	exists: "true",
	size: "1000",
	Builder: "None",
	Executor: "node",
}));
```
