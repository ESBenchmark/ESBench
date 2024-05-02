// This file is processed by .vitepress/suite-loader.ts
export interface SuiteInfo {
	name: string;
	category: string;
	code: string;
	cases: number;
	params: number;
}

export default [] as SuiteInfo[];

import("../../example/es/array-set-includes.js", {
	with: { name: "Array.includes vs Set.has" },
});
import("../../example/es/array-fill-with-length.js", {
	with: { name: "Fill array with size vs without size" },
});
import("../../example/es/array-sum.js", {
	with: { name: "Sum using for-loop vs Array.reduce" },
});
import("../../example/es/decode-base64.js", {
	with: { name: "Decode base64 string into ArrayBuffer" },
});
import("../../example/es/array-sort.js", {
	with: { name: "Array sort algorithms" },
});
import("../../example/es/string-join.js", {
	with: { name: "Combine strings" },
});
import("../../example/es/nullish-operator.js", {
	with: { name: "?? vs ||" },
});
import("../../example/es/deep-clone.js", {
	with: { name: "Deep clone serializable object" },
});

import("../../example/web/query-selector.js", {
	with: { name: "Attribute selector vs class selector" },
});
import("../../example/web/replace-children.js", {
	with: { name: "replaceChildren vs append" },
});
