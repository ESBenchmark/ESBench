export default async function (post, file) {
	const response = await fetch(file);
	const note = {
		type: "info",
		text: `Status: ${response.status}`,
	};
	await post({ paramDef: [], meta: {}, notes: [note], scenes: [] });
}
