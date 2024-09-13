export interface SuiteInfo {
	name: string;
	description?: string;
	path: string;
	code: string;
	cases: number;
	params: number;
}

// This file will be processed by .vitepress/suite-loader.ts
export default [] as SuiteInfo[];

// Use import syntax to leverage IDE's intellisense.
import("../../example/es/nullish-operator.js", {
	with: {
		name: "?? vs ||",
		description: "A simplest suite",
	},
});
import("../../example/es/array-sort.js", {
	with: {
		name: "Array sort algorithms",
		description: "Built-in sort() is slower than your quick sort",
	},
});
import("../../example/es/import-http-module.js", {
	with: {
		name: "Cartesian Product libraries",
		description: "How to import npm packages in playground",
	},
});
import("../../example/es/url-canParse.js", {
	with: {
		name: "URL.canParse",
		description: "How much faster is it than try-catch?",
	},
});
import("../../example/es/setTimeout-throttling.js", {
	with: {
		name: "setTimeout Throttling",
		description: "Find the minimum interval of setTimeout",
	},
});
import("../../example/es/cpu-cache.js", {
	with: {
		name: "Read with CPU Cache",
		description: "CPUs use is the L1/L2/L3 caches: those are like faster RAMs",
	},
});
import("../../example/es/object-iteration.js", {
	with: {
		name: "Iterate object entries",
		description: "How well the engine optimizes object literals?",
	},
});
import("../../example/es/string-join.js", {
	with: {
		name: "Combine strings",
		description: "Is using + to concatenate strings bad?",
	},
});
import("../../example/es/try-catch-loop.js", {
	with: {
		name: "Loop with try-catch",
		description: "Does try-catch block affect performance?",
	},
});
import("../../example/es/deep-clone.js", {
	with: { name: "Deep clone serializable object" },
});
import("../../example/es/array-set-includes.js", {
	with: {
		name: "Array.includes vs Set.has",
		description: "How much faster is querying a collection than an array?",
	},
});
import("../../example/es/array-fill-with-length.js", {
	with: {
		name: "Fill array with size vs without size",
		description: "Does initial size makes array faster?",
	},
});
import("../../example/es/array-sum.js", {
	with: {
		name: "Sum using for-loop vs Array.reduce",
		description: "Do for-of and Array.reduce() have performance overheads?",
	},
});

import("../../example/web/query-selector.js", {
	with: { name: "CSS Selector: attribute vs class" },
});
import("../../example/web/replace-children.js", {
	with: { name: "replaceChildren vs append" },
});
