const postMessage = message => fetch("/_es-bench/message", {
	method: "POST",
	body: JSON.stringify(message),
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// noinspection InfiniteLoopJS
for (; ; sleep(5)) {
	try {
		const response = await fetch("./_es-bench/task");
		if (!response.ok) {
			continue;
		}
		const { entry, files, pattern } = await response.json();
		const module = await import(entry);
		await module.default(postMessage, files, pattern);
	} catch {
		// ESBench finished, still poll for the next run.
	}
}
