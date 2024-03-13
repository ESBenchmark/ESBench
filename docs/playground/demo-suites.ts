import a from "../../example/src/array-set-includes.js";
import b from "../../example/src/array-with-length.js";
import c from "../../example/src/loop-reduce.js";
import d from "../../example/src/nullish-operator.js";

export interface SuiteInfo {
	name: string;
	code: string;
	params: number;
	cases: number;
}

export default <SuiteInfo[]>[a, b, c, d];
