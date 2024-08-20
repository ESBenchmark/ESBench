export default async function (post, file) {
	const response = await fetch(file);
	const status = response.status;
	const text = await response.text();
	await post({ paramDef: [], meta: {}, notes: [], scenes: [], status, text });
}
