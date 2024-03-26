import a from "../../example/es/array-set-includes.js";
import b from "../../example/es/array-with-length.js";
import c from "../../example/es/loop-reduce.js";
import d from "../../example/es/nullish-operator.js";
import e from "../../example/web/query-selector.js";

export interface SuiteInfo {
	name: string;
	category: string;
	code: string;
	cases: number;
	params: number;
}

export default <SuiteInfo[]>[a, b, c, d, e];
