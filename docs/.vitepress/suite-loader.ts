import { Plugin } from "vite";
import { traverse } from "estraverse";

export default <Plugin>{
	name: "esbench:suite-info",
	transform(code, id) {
		if (!/\/example\/.+?\/.+?\.js$/.test(id)) {
			return;
		}
		const exported: any = this.parse(code).body
			.find(node => node.type === "ExportDefaultDeclaration");

		if (!exported) {
			return; // Not a suite.
		}
		let name!: string;
		let cases = 0;
		let params = 0;

		function visitCase(node: any) {
			if (node.type !== "CallExpression") {
				return;
			}
			const n = node.callee.property?.name;
			if (/^bench(?:Async)?$/.test(n)) cases++;
		}

		const [suite] = exported.declaration.arguments;
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

		const info = JSON.stringify({ name, params, cases, code });
		return "export default " + info;
	},
};
