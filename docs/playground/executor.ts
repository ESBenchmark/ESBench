import esbenchClient from "esbench?url";
import srcdoc from "./sandbox.html?raw";

const esbenchURL = new URL(esbenchClient, location.href).toString();

const template = `\
import { connect } from "esbench";

const host = globalThis.parent ?? self;

const post = message => {
	host.postMessage(message);
	return new Promise(r => setTimeout(r));
};

const doImport = file => import(file);

connect(post, doImport, ["__FILE__"])`;

function createSandbox(module: string) {
	document.getElementById("sandbox")?.remove();

	const sandbox = document.createElement("iframe");
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

export async function executeIFrame(
	suiteCode: string,
	onMessage: any,
	clientPromise: Promise<unknown>,
) {
	const module = createModule(suiteCode);
	const loader = createModule(template.replace("__FILE__", module));
	const iframe = createSandbox(loader);

	window.addEventListener("message", m => {
		if (m.source === iframe.contentWindow)
			onMessage(m.data);
	});

	try {
		await clientPromise;
	} finally {
		iframe.remove();
		URL.revokeObjectURL(module);
		URL.revokeObjectURL(loader);
	}
}


export async function executeWorker(
	suiteCode: string,
	onMessage: any,
	clientPromise: Promise<unknown>,
) {
	const module = createModule(suiteCode);

	// https://github.com/WICG/import-maps/issues/2
	const loader = createModule(template
		.replace("__FILE__", module)
		.replace("esbench", esbenchURL));

	const worker = new Worker(loader, { type: "module" });
	worker.onmessage = x => onMessage(x.data);
	worker.onerror = e => console.error(e);
	try {
		await clientPromise;
	} finally {
		worker.terminate();
		URL.revokeObjectURL(module);
		URL.revokeObjectURL(loader);
	}
}