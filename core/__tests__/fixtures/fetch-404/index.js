export default async function (post, files) {
	const response = await fetch(files[0]);
	const note = {
		type: "info",
		text: `Status: ${response.status}`,
	};
	await post([{ paramDef: [], meta: {}, notes: [note], scenes: [] }]);
}
