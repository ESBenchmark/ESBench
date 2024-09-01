# Runner API

## Run a Suite

The `runSuite` function is provided for run a benchmark suite, and the results can be converted to a table using `SummaryTable`.

```javascript
import { defineSuite, runSuite, SummaryTable } from "esbench";

const suite = defineSuite(scene => {
	const values = Array.from({ length: 1000 }, Math.random);
	scene.bench("reduce", () => values.reduce((v, s) => s + v));
});

const result = await runSuite(suite);

// Convert the result to a table
const summaryTable = SummaryTable.from([result]);

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

Despite having `SummaryTable` to process the results, sometimes we need more primitive data structures. The return value of `runSuite` is intended to serialize, and it is recommended to use `Summary` to parse it instead of using it directly.

```javascript
import { Summary, runSuite } from "esbench";

const results = runSuite(/* ... */);

// ESBench provide a helper `Summary` to parse the results of runSuite.
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
