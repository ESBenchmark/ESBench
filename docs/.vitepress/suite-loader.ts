import { Plugin } from "vite";
import { traverse } from "estraverse";

/**
 * Remove all imports and the defineSuite() call.
 * Since WebWorker does not support import map, we cannot use imports in the suite.
 *
 * https://github.com/WICG/import-maps/issues/2
 */
function removeDefineSuite(code: string, body: any[], exports: any) {
	const { end, callee } = exports.declaration;
	code = removeRange(code, end - 1, end);
	code = removeRange(code, callee.start, callee.end + 1);

	return body.filter(n => n.type === "ImportDeclaration")
		.toReversed()
		.reduce((c, n) => removeRange(c, n.start, n.end), code);
}

function removeRange(str: string, start: number, end: number) {
	return str.slice(0, start) + str.slice(end);
}

export default <Plugin>{
	name: "esbench:suite-info",
	transform(code, id) {
		const match = /\/example\/(.+?)\/.+?\.js$/.exec(id);
		if (!match) {
			return;
		}
		const body = this.parse(code).body;
		const exports: any = body.find(n => n.type === "ExportDefaultDeclaration");

		if (!exports) {
			throw new Error("Import non-suite file from example?");
		}
		let name!: string;
		let cases = 0;
		let params = 0;

		function visitCase(node: any) {
			if (node.type !== "CallExpression") {
				return;
			}
			const n = node.callee.property?.name;
			if (/^bench(Async)?$/.test(n)) cases++;
		}

		const [suite] = exports.declaration.arguments;
		for (const { key, value } of suite.properties) {
			if (key.name === "name") {
				name = value.value;
			} else if (key.name === "params") {
				for (const prop of value.properties) {
					params += prop.value.elements.length;
				}
			} else if (key.name === "setup") {
				traverse(value, { enter: visitCase });
			}
		}

		code = removeDefineSuite(code, body, exports).trimStart();
		const category = match[1];
		const info = { name, category, params, cases, code };
		return "export default " + JSON.stringify(info);
	},
};
