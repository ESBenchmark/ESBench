if (globalThis.browser === undefined) {
	globalThis.browser = chrome;
}
export default async function (post) {
	const info = await browser.tabs.getCurrent();
	await post({ paramDef: [], meta: {}, notes: [], scenes: [], info });
}
