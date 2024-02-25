import esbenchClient from "esbench?url";
import srcdoc from "./sandbox.html?raw";

const template = `\
import { connect } from "esbench";

const post = message => {
	parent.postMessage(message);
	return new Promise(r => setTimeout(r));
};

const doImport = file => import(file);

connect(post, doImport, ["__FILE__"])`;

let sandbox: HTMLIFrameElement;

function createSandbox(module: string) {
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

function createModule(code: string) {
	return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
}

export async function execute(
	suiteCode: string,
	onMessage: any,
	clientPromise: Promise<unknown>,
) {
	const module = createModule(suiteCode);
	const loader = createModule(template.replace("__FILE__", module));
	const iframe = createSandbox(loader);

	window.addEventListener("message", m => {
		if (m.source === iframe.contentWindow) onMessage(m.data);
	});

	try {
		await clientPromise;
	} finally {
		iframe.remove();
		URL.revokeObjectURL(module);
		URL.revokeObjectURL(loader);
	}
}
