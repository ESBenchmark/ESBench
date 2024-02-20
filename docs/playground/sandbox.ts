import esbenchClient from "esbench?url";
import srcdoc from "./sandbox.html?raw";

// WebWorkers give a separate thread, but does not support DOM operations.
let sandbox: HTMLIFrameElement;

export function createSandbox(module: string) {
	document.getElementById("sandbox")?.remove();

	sandbox = document.createElement("iframe");
	sandbox.id = "sandbox";
	sandbox.setAttribute("sandbox", "allow-scripts allow-same-origin");

	const importMap = {
		imports: {
			"esbench": esbenchClient,
		},
	};
	sandbox.srcdoc = srcdoc
		.replace("<!--IMPORT_MAP-->", JSON.stringify(importMap))
		.replace("__SRC__", module);

	return document.body.appendChild(sandbox);
}
