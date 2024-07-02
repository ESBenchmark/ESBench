export interface SuiteInfo {
	name: string;
	description?: string;
	path: string;
	code: string;
	cases: number;
	params: number;
}

// This file will be transformed by .vitepress/suite-loader.ts
export default [] as SuiteInfo[];

// Import syntax is used to leverage IDE's intellisense.
import("../../example/es/nullish-operator.js", {
	with: {
		name: "?? vs ||",
		description: "A simplest suite example",
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
	with: { name: "setTimeout Throttling" },
});
import("../../example/es/decode-base64.js", {
	with: { name: "Decode base64 string" },
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
	with: { name: "Array.includes vs Set.has" },
});
import("../../example/es/array-fill-with-length.js", {
	with: { name: "Fill array with size vs without size" },
});
import("../../example/es/array-sum.js", {
	with: { name: "Sum using for-loop vs Array.reduce" },
});

import("../../example/web/query-selector.js", {
	with: { name: "CSS Selector: attribute vs class" },
});
import("../../example/web/replace-children.js", {
	with: { name: "replaceChildren vs append" },
});
