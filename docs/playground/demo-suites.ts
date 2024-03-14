import a from "../../example/src/array-set-includes.js";
import b from "../../example/src/array-with-length.js";
import c from "../../example/src/loop-reduce.js";
import d from "../../example/src/nullish-operator.js";
import e from "../../example/web/query-selector.js";

export interface SuiteInfo {
	name: string;
	category: string;
	code: string;
	cases: number;
	params: number;
}

export default <SuiteInfo[]>[a, b, c, d, e];
