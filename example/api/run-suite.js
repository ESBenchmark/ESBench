import { defineSuite, runSuite, SummaryTable } from "esbench";

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
