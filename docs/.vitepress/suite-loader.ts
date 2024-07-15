import { readFileSync } from "node:fs";
import { Plugin, Rollup } from "vite";
import { traverse } from "estraverse";

/**
 * Remove the import of `esbench` and the defineSuite() wrapper.
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
	const { type, elements, properties } = property.value;
	if (type === "ArrayExpression") {
		return count + elements.length;
	}
	if (type === "ObjectExpression") {
		return count + properties.length;
	}
	throw new TypeError("suite params must be literal of array or object");
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
		// Object-style suite.
		for (const { key, value } of suite.properties) {
			if (key.name === "params") {
				params = value.properties.reduce(countParams, 0);
			} else if (key.name === "setup") {
				traverse(value, { enter: visitCase });
			}
		}
	} else {
		// Function-style suite.
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

		// Skip `export default []` and the rest are imports.
		const imports = this.parse(code).body.slice(1);
		const suiteInfo = [];
		for (const { expression } of imports as any[]) {
			const file = expression.source.value;

			const r = await this.resolve(file, id);
			const suite = readFileSync(r.id, "utf8");
			this.addWatchFile(r.id);

			const info = getInfo.call(this, suite);
			suiteInfo.push(info);
			info.path = categoryRE.exec(file)[1];

			// Copy import attributes to suite info.
			const attrs = expression.options.properties[0].value;
			for (const p of attrs.properties) {
				info[p.key.name] = p.value.value;
			}
		}

		return "export default " + JSON.stringify(suiteInfo);
	},
};
