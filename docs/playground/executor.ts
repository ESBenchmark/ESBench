import type { Channel } from "esbench";
import esbenchClient from "esbench?url"; // Special handing in docs/esbench-runtime.ts

const esbenchURL = new URL(esbenchClient, location.href).href;

const template = `\
import { runAndSend } from "esbench";

const host = globalThis.parent ?? self;

const post = message => {
	host.postMessage(message);
	return new Promise(r => setTimeout(r));
};

const doImport = () => import("__FILE__");

runAndSend(post, doImport, "Playground Suite")`;

function createSandbox(module: string) {
	const importMap = JSON.stringify({
		imports: {
			"esbench": esbenchURL,
		},
	});

	const sandbox = document.createElement("iframe");
	sandbox.id = "sandbox";
	sandbox.style.display = "none";
	sandbox.setAttribute("sandbox", "allow-scripts allow-same-origin");
	sandbox.srcdoc = `\
		<!DOCTYPE html><html lang="en">
		<head>
			<meta charset="UTF-8">
			<title>Benchmark Sandbox</title>
			<script type="importmap">${importMap}</script>
			<script type="module" src="${module}"></script>
		</head>
		<body></body></html>`;

	document.getElementById("sandbox")?.remove();
	return document.body.appendChild(sandbox);
}

function createModule(code: string) {
	return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
}

export async function executeIFrame(
	suiteCode: string,
	onMessage: Channel,
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
	onMessage: Channel,
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
