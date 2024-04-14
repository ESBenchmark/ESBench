# JavaScript API

The `esbench` package exports 2 entry points:

* `esbench` Contains functions to run suites, and tools to deal with the results. It uses ES6 and a few Web APIs, can be used in browsers and most server-side runtimes.
  
* `esbench/host` Has CLI, executors, builders, and reporters. It is only usable from Node.js or other runtimes that compatible with Node API.

## Run Suites

```javascript
import { buildSummaryTable, defineSuite, runSuite } from "esbench";

const suite = defineSuite({
	name: "Array.sort",
	setup(scene) {
		const template = Array.from({ length: 1000 }, () => Math.random());
		let array = [];

		scene.beforeIteration(() => array = template.slice());
		scene.bench("builtin", () => array.sort((a, b) => a - b));
	},
});

const result = await runSuite(suite);

// Convert the result to a table
const summaryTable = buildSummaryTable([result]);

// Print the table
console.log("\n" + summaryTable.toMarkdown());
if (summaryTable.hints.length > 0) {
	console.log("Hints:");
	summaryTable.hints.forEach(n => console.log(n));
}
if (summaryTable.warnings.length > 0) {
	console.log("Warnings:");
	summaryTable.warnings.forEach(n => console.log(n));
}
```

## Summary
