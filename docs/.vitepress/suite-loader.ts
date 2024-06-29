import { readFileSync } from "fs";
import { Plugin, Rollup } from "vite";
import { traverse } from "estraverse";

/**
 * Remove all static imports and the defineSuite() call.
 * Since WebWorker does not support import map, we cannot use imports in the suite.
 *
 * https://github.com/WICG/import-maps/issues/2
 */
function removeDefineSuite(code: string, body: any[], exports: any) {
	const { end, callee } = exports.declaration;
	code = removeRange(code, end - 1, end);
	code = removeRange(code, callee.start, callee.end + 1);

	return body.filter(n => n.type === "ImportDeclaration" && n.source.value === "esbench")
		.reverse()
		.reduce((c, n) => removeRange(c, n.start, n.end), code);
}

function removeRange(str: string, start: number, end: number) {
	return str.slice(0, start) + str.slice(end);
}

function countParams(count: number, property: any) {
	const { type, elements } = property.value;
	if (type === "ArrayExpression") {
		return count + elements.length;
	}
	throw new TypeError("params of demo suite must be an array literal");
}

function getInfo(this: Rollup.PluginContext, code: string) {
	const body = this.parse(code).body;
	const exports: any = body.find(n => n.type === "ExportDefaultDeclaration");

	if (!exports) {
		throw new Error("Import a non-suite file from examples?");
	}
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
	if (suite.type === "ObjectExpression") {
		for (const { key, value } of suite.properties) {
			if (key.name === "params") {
				params = value.properties.reduce(countParams, 0);
			} else if (key.name === "setup") {
				traverse(value, { enter: visitCase });
			}
		}
	} else {
		traverse(suite.body, { enter: visitCase });
	}

	return {
		params,
		cases,
		code: removeDefineSuite(code, body, exports).trimStart(),
	};
}

const categoryRE = /\/example\/(.+?\/.+?\.js)$/;

export default <Plugin>{
	name: "esbench:suite-info",
	async transform(code, id) {
		if (!id.endsWith("/demo-suites.ts")) {
			return;
		}
		this.addWatchFile(id);

		const imports = this.parse(code).body.slice(1);
		const exports = [];
		for (const { expression } of imports as any[]) {
			const file = expression.source.value;
			const importAttrs = expression.options.properties[0].value;

			const r = await this.resolve(file, id);
			const suite = readFileSync(r.id, "utf8");
			this.addWatchFile(r.id);

			const info = getInfo.call(this, suite);
			for (const { key, value } of importAttrs.properties) {
				info[key.name] = value.value;
			}
			exports.push(info);
			info.path = categoryRE.exec(file)[1];
		}

		return "export default " + JSON.stringify(exports);
	},
};
